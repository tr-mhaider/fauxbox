package storage

import (
	"bytes"
	"embed"
	"path"
	"sort"
	"strings"
	"text/template"

	"github.com/axllent/mailpit/internal/logger"
	"github.com/axllent/semver"
)

//go:embed schemas/pg/*
var schemaScripts embed.FS

// Create tables and apply schemas if required
func dbApplySchemas() error {
	if _, err := db.Exec(`CREATE TABLE IF NOT EXISTS ` + tenant("schemas") + ` (Version TEXT PRIMARY KEY NOT NULL)`); err != nil {
		return err
	}

	schemaFiles, err := schemaScripts.ReadDir("schemas/pg")
	if err != nil {
		return err
	}

	temp := template.New("")
	temp.Funcs(
		template.FuncMap{
			"tenant": tenant,
		},
	)

	type schema struct {
		Name   string
		Semver string
	}

	scripts := []schema{}

	for _, s := range schemaFiles {
		if !s.Type().IsRegular() || !strings.HasSuffix(s.Name(), ".sql") {
			continue
		}

		schemaID := strings.TrimSuffix(s.Name(), ".sql")

		if !semver.IsValid(schemaID) {
			logger.Log().Warnf("[db] invalid schema name: %s", s.Name())
			continue
		}

		script := schema{s.Name(), semver.MajorMinor(schemaID) + "." + semver.Patch(schemaID)}
		scripts = append(scripts, script)
	}

	// sort schemas by semver, low to high
	sort.Slice(scripts, func(i, j int) bool {
		return semver.Compare(scripts[j].Semver, scripts[i].Semver) == 1
	})

	// detect whether this is an existing database (has prior schema entries)
	var existingSchemaCount int
	if err := db.QueryRow(`SELECT COUNT(*) FROM ` + tenant("schemas")).Scan(&existingSchemaCount); err != nil {
		return err
	}
	isExistingDB := existingSchemaCount > 0

	for _, s := range scripts {
		var complete int
		if err := db.QueryRow(`SELECT COUNT(*) FROM `+tenant("schemas")+` WHERE Version = $1`, s.Semver).Scan(&complete); err != nil {
			return err
		}

		if complete > 0 {
			// already completed, ignore
			continue
		}

		if isExistingDB {
			logger.Log().Infof("[db] applying schema updates: %s", s.Name)
		} else {
			logger.Log().Debugf("[db] applying schema updates: %s", s.Name)
		}

		// use path.Join for Windows compatibility, see https://github.com/golang/go/issues/44305
		b, err := schemaScripts.ReadFile(path.Join("schemas/pg", s.Name))
		if err != nil {
			return err
		}

		// parse import script
		t1, err := temp.Parse(string(b))
		if err != nil {
			return err
		}

		buf := new(bytes.Buffer)

		if err := t1.Execute(buf, nil); err != nil {
			return err
		}

		if err := execStatements(buf.String()); err != nil {
			return err
		}

		if _, err := db.Exec(`INSERT INTO `+tenant("schemas")+` (Version) VALUES ($1)`, s.Semver); err != nil {
			return err
		}
	}

	return nil
}

// execStatements runs a multi-statement SQL script one statement at a time.
// The pgx extended protocol rejects multiple commands in a single Exec, so we
// split on ";" (safe here as the schema files contain no semicolons in literals).
func execStatements(script string) error {
	// Strip "--" line comments first so semicolons inside them do not split
	// statements. The schema files contain no "--" inside string literals.
	var clean strings.Builder
	for _, line := range strings.Split(script, "\n") {
		if i := strings.Index(line, "--"); i >= 0 {
			line = line[:i]
		}
		clean.WriteString(line)
		clean.WriteString("\n")
	}

	for _, stmt := range strings.Split(clean.String(), ";") {
		s := strings.TrimSpace(stmt)
		if s == "" {
			continue
		}
		if _, err := db.Exec(s); err != nil {
			return err
		}
	}

	return nil
}

// These functions are used to migrate data formats/structure on startup.
func dataMigrations() {
	// ensure DeletedSize has a value if empty
	if SettingGet("DeletedSize") == "" {
		_ = SettingPut("DeletedSize", "0")
	}
}
