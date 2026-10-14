// Adds a fixed one-way delay to every TCP chunk between the app and a LOCAL Postgres, to show how
// route server time scales with database round-trip time. Local use only; no TLS, no auth handling.
//   node scripts/pg-latency-proxy.mjs <listenPort> <targetPort> <oneWayDelayMs>
import net from "node:net";

const [listenPort, targetPort, delay] = process.argv.slice(2).map(Number);
if (![listenPort, targetPort, delay].every(Number.isFinite)) throw new Error("Usage: pg-latency-proxy.mjs <listenPort> <targetPort> <oneWayDelayMs>");
net.createServer((client) => {
  const upstream = net.connect(targetPort, "127.0.0.1");
  // Equal delays keep per-direction ordering because timers with the same duration fire in creation order.
  const pipe = (from, to) => {
    from.on("data", (chunk) => setTimeout(() => { if (!to.destroyed) to.write(chunk); }, delay));
    from.on("end", () => setTimeout(() => to.end(), delay));
    from.on("error", () => to.destroy());
  };
  pipe(client, upstream);
  pipe(upstream, client);
}).listen(listenPort, "127.0.0.1", () => console.log(`pg-latency-proxy ${listenPort} -> ${targetPort}, +${delay}ms each way (RTT +${delay * 2}ms)`));
