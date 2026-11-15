#!/usr/bin/env node
// Делает N последовательных запросов к URL и считает время и скорость скачивания.
// Требуется Node.js 18+ (встроенный fetch). Внешние пакеты не нужны.

const DEFAULT_REQUESTS = 10;
const DEFAULT_TIMEOUT_SEC = 30;

function parseArgs(argv) {
    const args = { url: null, requests: DEFAULT_REQUESTS, timeout: DEFAULT_TIMEOUT_SEC };
    for (let i = 0; i < argv.length; i++) {
        const a = argv[i];
        if (a === "-n" || a === "--requests") args.requests = Number(argv[++i]);
        else if (a === "-t" || a === "--timeout") args.timeout = Number(argv[++i]);
        else if (!args.url) args.url = a;
    }
    if (!args.url || !Number.isInteger(args.requests) || args.requests < 1 || !(args.timeout > 0)) {
        console.error("Использование: node speedtest.js <url> [-n число_запросов] [-t таймаут_сек]");
        process.exit(2);
    }
    return args;
}

// Скачивает ответ целиком. Возвращает { bytes, seconds }.
async function fetchFully(url, timeoutSec) {
    const started = process.hrtime.bigint();
    const response = await fetch(url, {
        headers: { "User-Agent": "speedtest-script/1.0" },
        signal: AbortSignal.timeout(timeoutSec * 1000),
    });
    if (!response.ok) throw new Error(`HTTP ${response.status} ${response.statusText}`);

    let bytes = 0;
    for await (const chunk of response.body) bytes += chunk.length;

    const seconds = Number(process.hrtime.bigint() - started) / 1e9;
    return { bytes, seconds };
}

async function main() {
    const { url, requests, timeout } = parseArgs(process.argv.slice(2));
    let totalBytes = 0;
    let totalTime = 0;
    let ok = 0;

    for (let i = 1; i <= requests; i++) {
        try {
            const { bytes, seconds } = await fetchFully(url, timeout);
            ok++;
            totalBytes += bytes;
            totalTime += seconds;
            const speed = bytes / seconds / 1e6;
            console.log(`[${i}/${requests}] ${(bytes / 1e6).toFixed(2)} МБ за ${seconds.toFixed(3)} с (${speed.toFixed(2)} МБ/с)`);
        } catch (err) {
            const reason = err.cause?.message || err.message;
            console.log(`[${i}/${requests}] ошибка: ${reason}`);
        }
    }

    if (ok === 0) {
        console.log("Ни один запрос не удался.");
        process.exit(1);
    }

    const avgTime = totalTime / ok;
    const speedMB = totalBytes / totalTime / 1e6;
    const speedMbit = (totalBytes * 8) / totalTime / 1e6;

    console.log("\n--- Итог ---");
    console.log(`Успешных запросов:   ${ok} из ${requests}`);
    console.log(`Среднее время:       ${avgTime.toFixed(3)} с`);
    console.log(`Скачано всего:       ${(totalBytes / 1e6).toFixed(2)} МБ`);
    console.log(`Скорость скачивания: ${speedMB.toFixed(2)} МБ/с (${speedMbit.toFixed(2)} Мбит/с)`);
    process.exit(ok === requests ? 0 : 1);
}

main();
