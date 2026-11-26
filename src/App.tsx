import PosterCreator from "./components/PosterCreator";
import { POSTER_TEMPLATE } from "./config/template";
import "./App.css";

function App() {
  return (
    <div className="page">
      <header className="page-header">
        <img
          className="page-header-logo"
          src="/branding/heading-logo.png"
          alt={POSTER_TEMPLATE.name}
        />
      </header>

      <main>
        <PosterCreator />
      </main>

      
    </div>
  );
}

export default App;
