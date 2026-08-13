import Link from "next/link";
import { fetchPublicSite } from "../lib/site";
import "./marketing.css";

const CAPABILITIES = [
  { title: "项目与客户交付", body: "工作区、客户、品牌库和无限画布，把 brief 做到可审批的成片。" },
  { title: "AI 图文视频生成", body: "文生图、对话、视频走同一套任务队列和积分账本，失败自动退款。" },
  { title: "图像精修工作台", body: "人像美化、抠图、消除、变清晰与 RAW 显影，参数写入云端可复现。" },
  { title: "客户免登选片", body: "分享链接让客户在浏览器里看画布、评论和选片，不必注册后台。" },
];

export default async function MarketingPage() {
  const site = await fetchPublicSite();
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: site.site_title,
    applicationCategory: "MultimediaApplication",
    operatingSystem: "Web",
    description: site.site_description,
    url: site.public_origin || undefined,
  };

  return (
    <main className="mk-page" style={site.brand_color ? { ["--rv-color-primary" as string]: site.brand_color } : undefined}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <header className="mk-nav">
        <div className="mk-brand">
          {site.logo_url ? <img src={site.logo_url} alt="" className="mk-logo" /> : <span className="mk-mark">{site.site_title.slice(0, 1)}</span>}
          <strong>{site.site_title}</strong>
        </div>
        <nav className="mk-links">
          <Link href="/legal/terms">用户协议</Link>
          <Link href="/legal/privacy">隐私政策</Link>
          <Link href="/app" className="mk-cta-ghost">进入工作台</Link>
        </nav>
      </header>

      {site.site_announcement ? <p className="mk-announce">{site.site_announcement}</p> : null}

      <section className="mk-hero">
        <p className="mk-kicker">{site.site_tagline}</p>
        <h1>{site.site_title}</h1>
        <p className="mk-lead">{site.site_description}</p>
        <div className="mk-actions">
          <Link href="/app" className="mk-cta">进入工作台</Link>
          {site.allow_user_register ? <Link href="/app" className="mk-cta-ghost">注册账号</Link> : null}
        </div>
      </section>

      <section className="mk-grid">
        {CAPABILITIES.map((item) => (
          <article key={item.title} className="mk-card">
            <h2>{item.title}</h2>
            <p>{item.body}</p>
          </article>
        ))}
      </section>

      <footer className="mk-foot">
        <span>{site.site_title}</span>
        {site.contact_email ? <a href={`mailto:${site.contact_email}`}>{site.contact_email}</a> : null}
        <Link href="/legal/terms">用户协议</Link>
        <Link href="/legal/privacy">隐私政策</Link>
      </footer>
    </main>
  );
}
