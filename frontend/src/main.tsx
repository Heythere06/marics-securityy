import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';

function App() {
  return (
    <main className="shell">
      <nav className="nav"><strong>MARICS<span> / SECURITY</span></strong><a href="#how-it-works">How it works</a><a href="#features">Features</a><button>Sign in</button></nav>
      <section className="hero">
        <p className="eyebrow">Human risk intelligence platform</p>
        <h1>Make the safest response the easiest response.</h1>
        <p className="lede">MARICS turns realistic social-engineering moments into measurable, explainable security habits for people and organizations.</p>
        <div className="actions"><button className="primary">Start your assessment</button><a href="#how-it-works">Explore the approach <span aria-hidden="true">→</span></a></div>
      </section>
      <section id="how-it-works" className="signal-grid">
        <article><span>01</span><h2>See the setup</h2><p>Practice the pressure tactics attackers use in messages, calls, payments, and workplace requests.</p></article>
        <article><span>02</span><h2>Choose a response</h2><p>Make a decision in context, then get more than a score: understand the manipulation and the safer next move.</p></article>
        <article><span>03</span><h2>Build resilience</h2><p>Follow a personal risk profile and focused training path that improves with every scenario.</p></article>
      </section>
    </main>
  );
}

createRoot(document.getElementById('root')!).render(<StrictMode><App /></StrictMode>);