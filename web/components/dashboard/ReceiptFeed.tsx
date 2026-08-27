"use client";

export function ReceiptFeed() {
  return (
    <section className="panel receipts">
      <div className="receipts-head">
        <div>
          <span className="panel-title">Live receipt feed</span>
          <span className="panel-note" style={{ marginLeft: 9 }}>
            AgentVault events
          </span>
        </div>
        <div className="receipt-live">
          <i></i> LIVE
        </div>
      </div>
      <table className="receipt-table">
        <thead>
          <tr>
            <th>Result</th>
            <th>Recipient</th>
            <th>Amount</th>
            <th>Reason</th>
            <th>Block</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>
              <span className="result approved">✓ Approved</span>
            </td>
            <td>Airtime vendor</td>
            <td>5.00 USDT</td>
            <td>Within policy</td>
            <td className="hash">#18,420,291</td>
          </tr>
          <tr>
            <td>
              <span className="result approved">✓ Approved</span>
            </td>
            <td>Airtime vendor</td>
            <td>5.00 USDT</td>
            <td>Within policy</td>
            <td className="hash">#18,420,288</td>
          </tr>
          <tr>
            <td>
              <span className="result denied">× Denied</span>
            </td>
            <td>0xdead...beef</td>
            <td>500.00 USDT</td>
            <td>Exceeds daily cap</td>
            <td className="hash">#18,420,293</td>
          </tr>
        </tbody>
      </table>
    </section>
  );
}
