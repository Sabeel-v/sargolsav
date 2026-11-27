import PosterCreator from "./components/PosterCreator";
import { POSTER_TEMPLATE } from "./config/template";
import "./App.css";

function App() {
  return (
    <div className="page">
      <header className="page-header">
        <img
          className="page-header-logo"
          src="/branding/heading-logo.webp"
          alt={POSTER_TEMPLATE.name}
          // Reserve the logo's space before it loads, so the page doesn't
          // jump when it appears (Safari has no scroll anchoring).
          width={960}
          height={640}
          fetchPriority="high"
        />
      </header>

      <main>
        <PosterCreator />
      </main>

      
    </div>
  );
}

export default App;
