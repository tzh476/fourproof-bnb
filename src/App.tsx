import { useEffect, useMemo, useState } from "react";
import { buildActivationPlan, type ActivationPlan } from "./lib/activation";
import { fetchMarketplace } from "./lib/api";
import { categoryDefinitions } from "./lib/categories";
import { bscScanTokenUrl, bscScanTransactionUrl, verifyRegistryProof } from "./lib/onchain";
import { strongestService } from "./lib/scoring";
import type { AgentCategory, CategoryResult, RankedAgent, RegistryProof } from "./lib/types";

const categoryOrder = Object.keys(categoryDefinitions) as AgentCategory[];

const tierLabels: Record<RankedAgent["evidenceTier"], string> = {
  operational: "Operational evidence",
  reachable: "Reachable service metadata",
  registered: "Onchain identity",
  "metadata-only": "Metadata only",
};

function shortAddress(address: string): string {
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

function timeAgo(iso: string | null): string {
  if (!iso) return "not reported";
  const elapsed = Date.now() - new Date(iso).getTime();
  const minutes = Math.max(0, Math.round(elapsed / 60_000));
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 48) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

function EvidencePill({ label, state }: { label: string; state: "good" | "warn" | "bad" | "plain" }) {
  return <span className={`evidence-pill evidence-${state}`}>{label}</span>;
}

function AgentCard({
  agent,
  onSelect,
}: {
  agent: RankedAgent;
  onSelect: (agent: RankedAgent) => void;
}) {
  const service = strongestService(agent.services);
  const endpointState = service?.status === "healthy" ? "good" : service?.status === "degraded" ? "warn" : "bad";

  return (
    <article className="agent-card">
      <div className="agent-card-top">
        <div>
          <p className="eyebrow">ERC-8004 #{agent.tokenId}</p>
          <h3>{agent.name}</h3>
        </div>
        <div className={`score score-${agent.evidenceTier}`} aria-label={`Evidence score ${agent.evidenceScore}`}>
          {agent.evidenceScore}
        </div>
      </div>

      <p className="agent-description">{agent.description || "No description published."}</p>

      <div className="evidence-row" aria-label="Evidence summary">
        <EvidencePill label="BSC registry" state="good" />
        <EvidencePill
          label={agent.supportedProtocols.length ? agent.supportedProtocols.join(" + ") : "No protocol"}
          state={agent.supportedProtocols.length ? "plain" : "bad"}
        />
        <EvidencePill
          label={service ? `AgentCard ${service.status}` : "No service metadata"}
          state={endpointState}
        />
        {agent.x402Supported && <EvidencePill label="x402" state="plain" />}
      </div>

      <dl className="agent-metrics">
        <div>
          <dt>Evidence tier</dt>
          <dd>{tierLabels[agent.evidenceTier]}</dd>
        </div>
        <div>
          <dt>Metadata</dt>
          <dd>{Math.round(agent.metadataCompleteness)}%</dd>
        </div>
        <div>
          <dt>Health checked</dt>
          <dd>{timeAgo(service?.checkedAt ?? null)}</dd>
        </div>
        <div>
          <dt>Feedbacks</dt>
          <dd>{agent.totalFeedbacks}</dd>
        </div>
      </dl>

      <button className="primary-button" onClick={() => onSelect(agent)}>
        Inspect receipts
        <span aria-hidden="true">↗</span>
      </button>
    </article>
  );
}

function CategorySection({ result, onSelect }: { result: CategoryResult; onSelect: (agent: RankedAgent) => void }) {
  return (
    <section className="category-section" id={result.category.id} style={{ "--accent": result.category.accent } as React.CSSProperties}>
      <header className="category-header">
        <div className="category-number">{String(categoryOrder.indexOf(result.category.id) + 1).padStart(2, "0")}</div>
        <div>
          <p className="eyebrow">Equal-depth category</p>
          <h2>{result.category.label}</h2>
          <p>{result.category.description}</p>
        </div>
        <div className="source-stamp">
          <span className="live-dot" /> Live 8004scan
          <small>{timeAgo(result.fetchedAt)}</small>
        </div>
      </header>

      {result.warning && <p className="inline-warning">{result.warning}</p>}
      <div className="agent-grid">
        {result.agents.slice(0, 3).map((agent) => (
          <AgentCard key={`${agent.category}-${agent.tokenId}`} agent={agent} onSelect={onSelect} />
        ))}
        {result.agents.length === 0 && (
          <div className="empty-card">No candidate passed the category-relevance gate.</div>
        )}
      </div>
    </section>
  );
}

function Inspector({ agent, onClose }: { agent: RankedAgent; onClose: () => void }) {
  const [proof, setProof] = useState<RegistryProof | null>(null);
  const [proofError, setProofError] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [objective, setObjective] = useState("Compare this agent's read-only recommendation with current onchain data.");
  const [plan, setPlan] = useState<ActivationPlan | null>(null);
  const [planError, setPlanError] = useState<string | null>(null);
  const service = strongestService(agent.services);

  useEffect(() => {
    setProof(null);
    setProofError(null);
    setPlan(null);
    setPlanError(null);
  }, [agent.tokenId]);

  async function verify() {
    setVerifying(true);
    setProofError(null);
    try {
      setProof(await verifyRegistryProof(agent));
    } catch (error) {
      setProofError(error instanceof Error ? error.message : "Registry verification failed");
    } finally {
      setVerifying(false);
    }
  }

  function generatePlan() {
    setPlanError(null);
    try {
      setPlan(buildActivationPlan(agent, objective, proof));
    } catch (error) {
      setPlan(null);
      setPlanError(error instanceof Error ? error.message : "Activation plan could not be created");
    }
  }

  return (
    <div className="inspector-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <aside className="inspector" role="dialog" aria-modal="true" aria-label={`Evidence for ${agent.name}`}>
        <header className="inspector-header">
          <div>
            <p className="eyebrow">Evidence, not endorsements</p>
            <h2>{agent.name}</h2>
          </div>
          <button className="icon-button" onClick={onClose} aria-label="Close inspector">×</button>
        </header>

        <div className="receipt-block">
          <div className="receipt-heading">
            <span>01</span>
            <div><strong>Identity receipt</strong><small>Direct BSC read, not API trust</small></div>
          </div>
          <dl className="receipt-list">
            <div><dt>Registry</dt><dd>{shortAddress(agent.contractAddress)}</dd></div>
            <div><dt>Token</dt><dd>#{agent.tokenId}</dd></div>
            <div><dt>Indexed owner</dt><dd>{shortAddress(agent.ownerAddress)}</dd></div>
            {proof && <div><dt>Block</dt><dd>{proof.blockNumber.toString()}</dd></div>}
          </dl>
          <div className="button-row">
            <button className="secondary-button" onClick={verify} disabled={verifying}>
              {verifying ? "Checking BSC…" : proof ? "Verify again" : "Verify on BSC"}
            </button>
            <a className="text-link" href={bscScanTokenUrl(agent)} target="_blank" rel="noreferrer">BscScan ↗</a>
          </div>
          {proof && (
            <p className={proof.verified ? "status-good" : "status-bad"}>
              {proof.verified ? "Owner matches the live registry." : "Owner mismatch. Activation remains blocked."}
            </p>
          )}
          {proofError && <p className="status-bad">{proofError}</p>}
        </div>

        <div className="receipt-block">
          <div className="receipt-heading">
            <span>02</span>
            <div><strong>Service receipt</strong><small>Discovery health is not execution health</small></div>
          </div>
          <dl className="receipt-list">
            <div><dt>Protocol</dt><dd>{agent.supportedProtocols.join(", ") || "None"}</dd></div>
            <div><dt>Discovery URL</dt><dd>{service?.endpoint ? new URL(service.endpoint).hostname : "Not published"}</dd></div>
            <div><dt>Domain proof</dt><dd>{service?.domainVerified ? "verified" : "not verified"}</dd></div>
            <div><dt>Execution target</dt><dd>{service?.executionTargetVerified ? "bounded check passed" : "not validated"}</dd></div>
            <div><dt>Status</dt><dd>{service?.status ?? "unknown"}</dd></div>
            <div><dt>Last check</dt><dd>{timeAgo(service?.checkedAt ?? null)}</dd></div>
          </dl>
          {service?.message && <p className="service-message">{service.message}</p>}
          {agent.createdTxHash && (
            <a className="text-link" href={bscScanTransactionUrl(agent.createdTxHash)} target="_blank" rel="noreferrer">
              Registration transaction ↗
            </a>
          )}
        </div>

        <div className="receipt-block">
          <div className="receipt-heading">
            <span>03</span>
            <div><strong>Bounded activation</strong><small>No custody, trade, or message is sent here</small></div>
          </div>
          <label className="field-label" htmlFor="objective">Read-only objective</label>
          <textarea id="objective" value={objective} maxLength={500} onChange={(event) => setObjective(event.target.value)} />
          <button
            className="primary-button"
            onClick={generatePlan}
            disabled={agent.activationBlockedReasons.length > 0 || !proof?.verified}
          >
            Generate activation plan
          </button>
          {agent.activationBlockedReasons.length > 0 && (
            <div className="blocked-box">
              <strong>Activation blocked</strong>
              <ul>{agent.activationBlockedReasons.map((reason) => <li key={reason}>{reason}</li>)}</ul>
            </div>
          )}
          {agent.activationBlockedReasons.length === 0 && !proof?.verified && (
            <p className="status-bad">Verify the live BSC owner before generating a plan.</p>
          )}
          {planError && <p className="status-bad">{planError}</p>}
          {plan && <pre className="plan-preview">{JSON.stringify(plan, null, 2)}</pre>}
        </div>
      </aside>
    </div>
  );
}

export default function App() {
  const [results, setResults] = useState<CategoryResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<RankedAgent | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      setResults(await fetchMarketplace());
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Could not load the marketplace");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  const stats = useMemo(() => {
    const agents = results.flatMap((result) => result.agents);
    return {
      categories: results.length,
      candidates: agents.length,
      operational: agents.filter((agent) => agent.evidenceTier === "operational").length,
      blocked: agents.filter((agent) => agent.activationBlockedReasons.length > 0).length,
    };
  }, [results]);

  return (
    <div className="app-shell">
      <header className="topbar">
        <a className="brand" href="#top" aria-label="FourProof home">
          <span className="brand-mark">4P</span>
          <span>FourProof</span>
        </a>
        <nav aria-label="Marketplace categories">
          {categoryOrder.map((category) => (
            <a key={category} href={`#${category}`}>{categoryDefinitions[category].shortLabel}</a>
          ))}
        </nav>
        <button className="refresh-button" onClick={() => void load()} disabled={loading}>
          {loading ? "Syncing…" : "Refresh evidence"}
        </button>
      </header>

      <main id="top">
        <section className="hero">
          <div className="hero-copy">
            <p className="eyebrow">BNB Agent Studio marketplace concept</p>
            <h1>Find the agent.<br />Check the receipts.</h1>
            <p className="hero-lede">
              Live BSC identity, discovery health, protocol support, and execution gates—before an agent gets near a wallet.
            </p>
            <div className="hero-actions">
              <a className="primary-button" href="#rebalancing">Browse four categories</a>
              <a className="text-link" href="https://www.8004scan.io/" target="_blank" rel="noreferrer">Data source ↗</a>
            </div>
          </div>
          <div className="hero-scorecard" aria-label="Live marketplace summary">
            <p className="eyebrow">Live proof index</p>
            <div className="scorecard-grid">
              <div><strong>{stats.categories}/4</strong><span>categories live</span></div>
              <div><strong>{stats.candidates}</strong><span>ranked identities</span></div>
              <div><strong>{stats.operational}</strong><span>operational tier</span></div>
              <div><strong>{stats.blocked}</strong><span>safely blocked</span></div>
            </div>
            <p className="truth-note"><span /> Agent descriptions are claims. Green receipts are observed facts.</p>
          </div>
        </section>

        <section className="method-strip" aria-label="How evidence moves through FourProof">
          <div><span>01</span><strong>Discover</strong><small>Search all four required categories</small></div>
          <div><span>02</span><strong>Verify</strong><small>Read registry and discovery evidence</small></div>
          <div><span>03</span><strong>Gate</strong><small>Block untested targets or wallets</small></div>
          <div><span>04</span><strong>Activate</strong><small>Generate a bounded, read-only plan</small></div>
        </section>

        {error && (
          <section className="error-panel">
            <strong>Live discovery unavailable</strong>
            <p>{error}</p>
            <button className="secondary-button" onClick={() => void load()}>Try again</button>
          </section>
        )}

        {loading && results.length === 0 && (
          <section className="loading-panel">
            <div className="loading-line" />
            <p>Reading BSC identities and service-discovery evidence…</p>
          </section>
        )}

        <div className="categories-wrap">
          {categoryOrder.map((category) => {
            const result = results.find((item) => item.category.id === category);
            return result ? <CategorySection key={category} result={result} onSelect={setSelected} /> : null;
          })}
        </div>

        <section className="disclosure">
          <p className="eyebrow">Trust boundary</p>
          <h2>No custody. No inferred performance. No green badge for a good pitch.</h2>
          <p>
            FourProof ranks observable identity and service evidence. It does not endorse returns, move funds, or treat an ERC-8004 registration as proof that an agent is safe or profitable.
          </p>
        </section>
      </main>

      <footer>
        <span>FourProof prototype · BSC mainnet identity reads</span>
        <span>Built for The Smart Money Era · USD 0 received</span>
      </footer>

      {selected && <Inspector agent={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}
