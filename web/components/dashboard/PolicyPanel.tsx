"use client";

import { useEffect, useState } from "react";
import { formatUnits, parseUnits } from "viem";
import {
  useAccount,
  useWaitForTransactionReceipt,
  useWriteContract,
} from "wagmi";
import { agentVaultAbi } from "@/lib/abi";
import { AGENT_ADDRESS, AGENT_VAULT_ADDRESS } from "@/lib/contracts";
import { ALLOWLIST_ENTRIES } from "@/lib/allowlist";
import { usePolicyData } from "@/lib/usePolicyData";
import { MUSDT_DECIMALS } from "@/lib/format";

const SEVEN_DAYS_SECONDS = 7 * 24 * 60 * 60;

function truncate(address: string) {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

export function PolicyPanel() {
  // Local values the owner is editing. Start at reasonable placeholder
  // defaults; the effect below overwrites them with the REAL live policy
  // the first time it loads, so a page refresh reflects on-chain reality
  // instead of silently showing stale hardcoded numbers (e.g. if the owner
  // applied a higher daily cap in an earlier session and then reloaded).
  const [txCap, setTxCap] = useState(10);
  const [dailyCap, setDailyCap] = useState(20);
  const [active, setActive] = useState(true);
  const [hasSeededFromChain, setHasSeededFromChain] = useState(false);

  const { address: ownerAddress, isConnected } = useAccount();
  const { policy, refetch: refetchPolicyData } = usePolicyData();

  // Seed the sliders/toggle from the real on-chain policy exactly once,
  // the first time a read resolves — not on every poll, so it doesn't
  // fight the owner while they're mid-drag on a slider.
  useEffect(() => {
    if (!policy || hasSeededFromChain) return;
    setTxCap(Number(formatUnits(policy.maxPerTx, MUSDT_DECIMALS)));
    setDailyCap(Number(formatUnits(policy.dailyCap, MUSDT_DECIMALS)));
    setActive(policy.active);
    setHasSeededFromChain(true);
  }, [policy, hasSeededFromChain]);

  const {
    writeContract: writeSetPolicy,
    data: setPolicyHash,
    isPending: isSetPolicyPending,
    error: setPolicyError,
  } = useWriteContract();

  const {
    writeContract: writeRevoke,
    data: revokeHash,
    isPending: isRevokePending,
    error: revokeError,
  } = useWriteContract();

  const { isLoading: isSetPolicyConfirming, isSuccess: isSetPolicySuccess } =
    useWaitForTransactionReceipt({ hash: setPolicyHash });

  const { isLoading: isRevokeConfirming, isSuccess: isRevokeSuccess } =
    useWaitForTransactionReceipt({ hash: revokeHash });

  // On a confirmed write, also refetch the shared policy-data query right
  // away — usePolicyData's other consumers (StatTiles, ChainStatePanel)
  // read the SAME cached query, so this settles their view within about a
  // second instead of leaving them to visibly disagree with this panel for
  // up to 5s until the next background poll (most noticeable during the
  // demo's revoke beat, where one badge flipping before the other would
  // look like a real inconsistency on screen).
  useEffect(() => {
    if (isSetPolicySuccess) {
      setActive(true);
      refetchPolicyData();
    }
  }, [isSetPolicySuccess, refetchPolicyData]);

  useEffect(() => {
    if (isRevokeSuccess) {
      setActive(false);
      refetchPolicyData();
    }
  }, [isRevokeSuccess, refetchPolicyData]);

  const applyBusy = isSetPolicyPending || isSetPolicyConfirming;
  const revokeBusy = isRevokePending || isRevokeConfirming;
  // Apply and Revoke each track their own pending state independently (two
  // separate useWriteContract instances), but they both write to the same
  // policy — gate every action on BOTH being idle, not just its own, so a
  // user can't fire setPolicy and revoke concurrently from the same wallet
  // with no defined resolution order between the two transactions.
  const anyBusy = applyBusy || revokeBusy;

  function applyPolicy() {
    if (anyBusy) return;
    writeSetPolicy({
      address: AGENT_VAULT_ADDRESS,
      abi: agentVaultAbi,
      functionName: "setPolicy",
      args: [
        AGENT_ADDRESS,
        parseUnits(String(txCap), 6),
        parseUnits(String(dailyCap), 6),
        ALLOWLIST_ENTRIES.map((entry) => entry.address),
        BigInt(Math.floor(Date.now() / 1000) + SEVEN_DAYS_SECONDS),
      ],
    });
  }

  function revokePolicy() {
    if (anyBusy) return;
    writeRevoke({
      address: AGENT_VAULT_ADDRESS,
      abi: agentVaultAbi,
      functionName: "revoke",
      args: [AGENT_ADDRESS],
    });
  }

  return (
    <section className="panel">
      <div className="panel-head">
        <span className="panel-title">Active policy</span>
        <span className="panel-note">Last edited just now</span>
      </div>
      <div className="policy-body">
        <div className="policy-agent">
          <div className="agent-info">
            <div className="agent-avatar">✦</div>
            <div>
              <strong>TopUp Agent</strong>
              <small>{truncate(AGENT_ADDRESS)}</small>
            </div>
          </div>
          <button
            className={`toggle${active ? "" : " off"}`}
            aria-label={
              active
                ? "Revoke agent access (one-way)"
                : "Reapply policy to reactivate"
            }
            title={
              active
                ? "Revoke agent access. This is one-way — reactivating requires applying a policy again."
                : "Policy revoked. Click to apply the current settings and reactivate."
            }
            disabled={!isConnected || anyBusy}
            onClick={active ? revokePolicy : applyPolicy}
          >
            <i></i>
          </button>
        </div>
        <div className="control">
          <div className="control-row">
            <label>Max per transaction</label>
            <span className="control-value">${txCap} USDT</span>
          </div>
          <input
            type="range"
            min={1}
            max={100}
            value={txCap}
            onChange={(e) => setTxCap(Number(e.target.value))}
          />
          <div className="range-labels">
            <span>1 USDT</span>
            <span>100 USDT</span>
          </div>
        </div>
        <div className="control">
          <div className="control-row">
            <label>Daily spending cap</label>
            <span className="control-value">${dailyCap} USDT</span>
          </div>
          <input
            type="range"
            min={5}
            max={200}
            value={dailyCap}
            onChange={(e) => setDailyCap(Number(e.target.value))}
          />
          <div className="range-labels">
            <span>5 USDT</span>
            <span>200 USDT</span>
          </div>
        </div>
        <div className="allowlist">
          <div className="allowlist-title">
            Allowed recipients{" "}
            <span style={{ color: "var(--dim)" }}>
              · {ALLOWLIST_ENTRIES.length} addresses
            </span>
          </div>
          {ALLOWLIST_ENTRIES.map((entry) => (
            <div className="recipient" key={entry.address}>
              <div className="recipient-left">
                <div className="recipient-mark">
                  {entry.label.charAt(0).toUpperCase()}
                </div>
                <div>
                  <strong>{entry.label}</strong>
                  <small>{truncate(entry.address)}</small>
                </div>
              </div>
            </div>
          ))}
          <button
            className="add-recipient"
            disabled
            title="Allowlist is fixed via config for this demo — editing per-entry isn't supported yet"
          >
            ＋ Add recipient
          </button>
        </div>
        <div className="expiry">
          <span className="mini-icon">◷</span>
          <span>
            Applying now sets expiry to{" "}
            <b style={{ color: "var(--text)" }}>7 days from now</b>
          </span>
        </div>

        <div style={{ marginTop: 17, display: "grid", gap: 8 }}>
          <button
            onClick={applyPolicy}
            disabled={!isConnected || anyBusy}
            style={{
              width: "100%",
              padding: "10px",
              borderRadius: 8,
              border: "1px solid #36513c",
              background: applyBusy ? "#152018" : "var(--lime)",
              color: applyBusy ? "var(--lime)" : "#132014",
              fontWeight: 700,
              fontSize: 12,
              opacity: !isConnected ? 0.5 : 1,
              cursor: !isConnected || anyBusy ? "not-allowed" : "pointer",
            }}
          >
            {applyBusy ? "Applying..." : "Apply policy onchain"}
          </button>
          <button
            onClick={revokePolicy}
            disabled={!isConnected || !active || anyBusy}
            style={{
              width: "100%",
              padding: "9px",
              borderRadius: 8,
              border: "1px solid #4a2323",
              background: "transparent",
              color: "var(--red)",
              fontWeight: 600,
              fontSize: 11,
              opacity: !isConnected || !active ? 0.5 : 1,
              cursor:
                !isConnected || !active || anyBusy
                  ? "not-allowed"
                  : "pointer",
            }}
          >
            {revokeBusy
              ? "Revoking..."
              : active
                ? "Revoke agent access"
                : "Revoked"}
          </button>
          {!isConnected && (
            <div style={{ color: "var(--dim)", fontSize: 11 }}>
              Connect your wallet to manage the policy.
            </div>
          )}
          {isConnected && ownerAddress && (
            <div style={{ color: "var(--dim)", fontSize: 10 }}>
              Signing as {truncate(ownerAddress)}
            </div>
          )}
          {setPolicyError && (
            <div style={{ color: "var(--red)", fontSize: 11 }}>
              {setPolicyError.message.split("\n")[0]}
            </div>
          )}
          {revokeError && (
            <div style={{ color: "var(--red)", fontSize: 11 }}>
              {revokeError.message.split("\n")[0]}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
