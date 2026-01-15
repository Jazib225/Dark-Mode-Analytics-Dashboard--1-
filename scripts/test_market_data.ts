
import { getMarketList, getMarketDetail } from '../src/server/polymarket/marketService';

async function run() {
    console.log("Testing Market List...");
    const list = await getMarketList('trending', 5);
    console.log(`Fetched ${list.length} markets.`);

    if (list.length === 0) {
        console.error("FAILED: No markets returned.");
        return;
    }

    const m = list[0];
    console.log("First Market:", JSON.stringify(m, null, 2));

    if (!m.id || !m.question) console.error("FAILED: Missing ID or Question");
    if (!m.outcomes || m.outcomes.length < 2) console.error("FAILED: Missing outcomes");
    if (m.outcomes.some(o => o.price === null)) console.warn("WARNING: Some prices are null (could be CLOB error)");
    if (m.outcomes.every(o => o.price === null)) console.error("FAILED: ALL prices are null");

    console.log("\nTesting Market Detail...");
    const detail = await getMarketDetail(m.id);
    console.log("Detail:", JSON.stringify(detail, null, 2));

    if (!detail) console.error("FAILED: Detail returned null");
}

run().catch(console.error);
