export default function Home() {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "not configured";

  return (
    <main style={{ fontFamily: "system-ui, sans-serif", padding: "2rem", maxWidth: 640 }}>
      <h1>Fauxbox</h1>
      <p>Multi-tenant email testing. This is the placeholder web app scaffolded in Phase 0.</p>
      <p>
        API base URL: <code>{apiUrl}</code>
      </p>
      <p>The real dashboard is built in Phases 8 and 9 on the shared design system.</p>
    </main>
  );
}
