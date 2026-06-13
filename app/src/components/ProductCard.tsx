import { Candidate } from "@/lib/types";
import { AFFILIATE_DISCLOSURE } from "@/lib/affiliate/amazon";

function price(c: Candidate): string {
  const p = c.product.offer.final_price;
  const cur = c.product.offer.currency || "USD";
  if (p == null) return "—";
  return cur === "USD" ? `$${p.toFixed(2)}` : `${p} ${cur}`;
}

export default function ProductCard({ c }: { c: Candidate }) {
  return (
    <div className="card">
      <div className="top">
        <span className="title">
          {c.product.brand ? `${c.product.brand} · ` : ""}
          {c.product.title_canonical}
        </span>
        <span className="price">{price(c)}</span>
      </div>
      <div className="why">✓ {c.why}</div>
      {c.tradeoff && <div className="why" style={{ color: "var(--muted)" }}>代价：{c.tradeoff}</div>}
      <div className="chips">
        {c.matched.map((m, i) => (
          <span key={i} className="chip">{m}</span>
        ))}
      </div>
      <a className="buy" href={c.buy_url} target="_blank" rel="noopener noreferrer nofollow sponsored">
        去购买
      </a>
      <div className="aff">{AFFILIATE_DISCLOSURE}</div>
    </div>
  );
}
