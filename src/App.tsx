import PosterCreator from "./components/PosterCreator";
import { POSTER_TEMPLATE } from "./config/template";
import "./App.css";

function App() {
  return (
    <div className="page">
      <header className="page-header">
        <h1>{POSTER_TEMPLATE.name}</h1>
        <p>Upload your photo and create your personal poster in seconds.</p>
      </header>

      <main>
        <PosterCreator />
      </main>

      <footer className="page-footer">
        <p>Made with CIER &middot; All processing happens on your device.</p>
      </footer>
    </div>
  );
}

export default App;
