import Chat from "@/components/Chat";

export default function Home() {
  return (
    <main className="wrap">
      <div className="brand">
        <h1>Zeno</h1>
        <span className="tag">描述需求，而不是品牌</span>
      </div>
      <div className="disclosure">
        Zeno 是 AI 购物助手，推荐由 AI 生成、可能有误，下单前请核对。含返佣链接，返佣不影响排序。
      </div>
      <Chat />
    </main>
  );
}
