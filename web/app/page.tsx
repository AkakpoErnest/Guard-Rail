import { Sidebar } from "@/components/dashboard/Sidebar";
import { Topbar } from "@/components/dashboard/Topbar";
import { StatTiles } from "@/components/dashboard/StatTiles";
import { PolicyPanel } from "@/components/dashboard/PolicyPanel";
import { ChatPanel } from "@/components/dashboard/ChatPanel";
import { ChainStatePanel } from "@/components/dashboard/ChainStatePanel";
import { ReceiptFeed } from "@/components/dashboard/ReceiptFeed";

export default function DashboardPage() {
  return (
    <div className="app">
      <Sidebar />
      <main className="content">
        <Topbar />
        <StatTiles />
        <div className="dashboard">
          <PolicyPanel />
          <div className="right-stack">
            <section className="panel workspace">
              <ChatPanel />
              <ChainStatePanel />
            </section>
            <ReceiptFeed />
          </div>
        </div>
      </main>
    </div>
  );
}
