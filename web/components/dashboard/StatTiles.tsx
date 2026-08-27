"use client";

import { usePolicyData } from "@/lib/usePolicyData";
import { PLACEHOLDER, formatAmount } from "@/lib/format";

export function StatTiles() {
  const { policy, dailySpentToday, vaultBalance, isLoading } = usePolicyData();

  const dailyCap = policy?.dailyCap;
  const remaining =
    dailyCap !== undefined && dailySpentToday !== undefined
      ? dailyCap > dailySpentToday
        ? dailyCap - dailySpentToday
        : 0n
      : undefined;

  const now = Math.floor(Date.now() / 1000);
  let policyStatus: "ACTIVE" | "REVOKED" | "EXPIRED" | undefined;
  if (policy) {
    if (!policy.active) {
      policyStatus = "REVOKED";
    } else if (policy.expiry !== 0n && policy.expiry < BigInt(now)) {
      policyStatus = "EXPIRED";
    } else {
      policyStatus = "ACTIVE";
    }
  }

  return (
    <section className="overview">
      <div className="stat">
        <div className="stat-label">Available balance</div>
        <div className="stat-value">
          <span>$</span>
          <span>{isLoading ? PLACEHOLDER : formatAmount(vaultBalance)}</span>{" "}
          <span>USDT</span>
        </div>
        <div className="stat-foot">
          <em>{isLoading ? PLACEHOLDER : formatAmount(policy?.maxPerTx)} USDT</em>{" "}
          max per transaction
        </div>
      </div>
      <div className="stat">
        <div className="stat-label">Spent today</div>
        <div className="stat-value">
          <span>$</span>
          <span>{isLoading ? PLACEHOLDER : formatAmount(dailySpentToday)}</span>{" "}
          <span>
            / <span>{isLoading ? PLACEHOLDER : formatAmount(dailyCap)}</span> USDT
          </span>
        </div>
        <div className="stat-foot">
          <em>{isLoading ? PLACEHOLDER : formatAmount(remaining)} USDT</em>{" "}
          remaining in daily cap
        </div>
      </div>
      <div className="stat">
        <div className="stat-label">Policy status</div>
        <div className="stat-value">
          <span>{isLoading ? PLACEHOLDER : (policyStatus ?? PLACEHOLDER)}</span>
        </div>
        <div className="stat-foot">
          {isLoading || !policy
            ? PLACEHOLDER
            : policyStatus === "ACTIVE"
              ? (
                <>
                  Expires{" "}
                  <em>
                    {new Date(Number(policy.expiry) * 1000).toLocaleDateString()}
                  </em>
                </>
              )
              : policyStatus === "EXPIRED"
                ? (
                  <>
                    Expired{" "}
                    <em>
                      {new Date(Number(policy.expiry) * 1000).toLocaleDateString()}
                    </em>
                  </>
                )
                : <>Access has been <em>revoked</em> by the owner</>}
        </div>
      </div>
    </section>
  );
}
