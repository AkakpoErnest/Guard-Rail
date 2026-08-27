"use client";

export function StatTiles() {
  return (
    <section className="overview">
      <div className="stat">
        <div className="stat-label">Available balance</div>
        <div className="stat-value">
          <span>$</span>
          <span>84.20</span> <span>USDT</span>
        </div>
        <div className="stat-foot">
          <em>+12.40 USDT</em> funded this week
        </div>
      </div>
      <div className="stat">
        <div className="stat-label">Spent today</div>
        <div className="stat-value">
          <span>$</span>
          <span>10.00</span>{" "}
          <span>
            / <span>20</span> USDT
          </span>
        </div>
        <div className="stat-foot">
          <em>10.00 USDT</em> remaining in daily cap
        </div>
      </div>
      <div className="stat">
        <div className="stat-label">Protected transactions</div>
        <div className="stat-value">
          <span>2</span> <span>approved</span>
        </div>
        <div className="stat-foot">
          <em>1 blocked</em> by policy this session
        </div>
      </div>
    </section>
  );
}
