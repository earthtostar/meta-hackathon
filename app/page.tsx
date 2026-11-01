import Composer from "../components/Composer";
import Explorer from "../components/Explorer";
import StoryVault from "../components/StoryVault";

export default function Home() {
  return (
    <div className="page">
      <header className="site-header">
        <p className="wordmark">
          Experience Match{" "}
          <span className="prototype-tag">Prototype</span>
        </p>
      </header>

      <main>
        <div className="intro">
          <h1>Someone has been where you are.</h1>
          <p>
            Describe your problem, browse fictional examples of practical
            experience, and see what overlaps — and what does not. Any contact
            would only ever open with mutual consent.
          </p>
        </div>

        <div className="workspace">
          <div className="composer-pane">
            <Composer />
            <StoryVault />
          </div>
          <div className="explorer-pane">
            <Explorer />
          </div>
        </div>
      </main>

      <footer className="page-footer">
        Experience Match prototype. Demo stories are fictional and
        self-reported experience is never treated as verified.
      </footer>
    </div>
  );
}
