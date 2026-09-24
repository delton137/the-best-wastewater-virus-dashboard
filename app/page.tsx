import Dashboard from "./components/Dashboard";

export default async function Home({ searchParams }: {
  searchParams: Promise<{ view?: string }>;
}) {
  const { view } = await searchParams;
  return (
    <>
      <header className="app-header">
        <h1>Global Wastewater Viral Surveillance</h1>
        <span className="sub">
          SARS-CoV-2 · influenza · and more — from public sources worldwide
        </span>
        <nav>
          <a href="/coverage">Coverage</a>
        </nav>
      </header>
      <Dashboard initialView={view === "seasonal" ? "seasonal" : "trends"} />
    </>
  );
}
