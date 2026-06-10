import { ObjectLayer } from './ObjectLayer.js';
import { Ticker } from 'pixi.js';

/**
 * Benchmark for refreshForeignCreepLabels and refreshForeignCreepBadges
 * to verify performance improvements.
 */
function runBenchmark() {
    const mockTicker = {
        add: () => {},
        remove: () => {}
    } as unknown as Ticker;

    const layer = new ObjectLayer(mockTicker, true, 'me');

    const N = 10000;
    const diff: any = {};
    for (let i = 0; i < N; i++) {
        diff[`obj_${i}`] = { type: i % 100 === 0 ? 'creep' : 'wall', x: 0, y: 0, user: i % 100 === 0 ? 'enemy' : undefined };
    }

    layer.update(diff, diff, { 'me': { _id: 'me', username: 'me' } }, 0);

    const START_ITERATIONS = 1000;

    console.time('refreshForeignCreepLabels');
    for (let i = 0; i < START_ITERATIONS; i++) {
        // @ts-ignore
        layer.refreshForeignCreepLabels();
    }
    console.timeEnd('refreshForeignCreepLabels');

    console.time('refreshForeignCreepBadges');
    for (let i = 0; i < START_ITERATIONS; i++) {
        // @ts-ignore
        layer.refreshForeignCreepBadges();
    }
    console.timeEnd('refreshForeignCreepBadges');
}

runBenchmark();
