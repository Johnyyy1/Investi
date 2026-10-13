import lab from "@/components/lab/portfolio/portfolio-lab.module.css";

export default function PortfolioMixLoading() {
  return <main className={`investi-theme ${lab.page}`} aria-busy="true"><div className={lab.container}>
    <div className={lab.eyebrowRow}><p className={lab.eyebrow}>Portfolio Lab · mix</p></div>
    <p role="status" className={lab.meta} style={{ marginTop: 12 }}>Ověřujeme ceny nástrojů v mixu…</p>
    <div className={lab.skeleton} aria-hidden="true" />
  </div></main>;
}
