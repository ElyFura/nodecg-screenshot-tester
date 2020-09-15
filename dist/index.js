'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
// Native
const fs = require("fs");
// Packages
const pixelmatch = require("pixelmatch");
const pngjs_1 = require("pngjs");
const puppeteer = require("puppeteer");
// Ours
const server = require("./screenshot-server");
const screenshot_taker_1 = require("./screenshot-taker");
const screenshot_consts_1 = require("./screenshot-consts");
const make_temp_dir_1 = require("./make-temp-dir");
const yargs_1 = require("yargs");
exports.comparisonTests = (test) => {
    const tempDir = make_temp_dir_1.makeTempDir(test);
    let _browser;
    test.before(async () => {
        console.log('temp dir:', tempDir);
        await server.open();
        _browser = await puppeteer.launch(screenshot_consts_1.CONSTS.PUPPETEER_LAUNCH_OPTS);
    });
    test.after.always(() => {
        server.close();
        if (_browser) {
            _browser.close();
        }
    });
    const filterRegExp = new RegExp(yargs_1.argv.filter);
    if (yargs_1.argv.filter) {
        console.log('Filter:', filterRegExp);
    }
    screenshot_consts_1.CONSTS.TEST_CASES.forEach((testCase) => {
        const testName = screenshot_taker_1.computeFullTestCaseName(testCase);
        if (!filterRegExp.test(testName)) {
            return;
        }
        test.serial(testName, async (t) => {
            const page = await _browser.newPage();
            await page.setViewport(screenshot_taker_1.computeTestCaseResolution(testCase));
            await page.evaluateOnNewDocument(() => {
                window.__SCREENSHOT_TESTING__ = true;
            });
            await screenshot_taker_1.screenshotGraphic(page, testCase, {
                captureLogs: true,
                destinationDir: tempDir
            });
            const fileName = screenshot_taker_1.computeFullTestCaseName(testCase);
            return compareScreenshots(t, fileName);
        });
    });
    function compareScreenshots(t, fileName) {
        return new Promise(resolve => {
            const rawResultImage = fs.readFileSync(`${tempDir}/${fileName}.png`);
            const rawFixtureImage = fs.readFileSync(`${screenshot_consts_1.CONSTS.FIXTURE_SCREENSHOTS_DIR}/${fileName}.png`);
            const resultImage = new pngjs_1.PNG().parse(rawResultImage, doneReading);
            const fixtureImage = new pngjs_1.PNG().parse(rawFixtureImage, doneReading);
            let filesRead = 0;
            function doneReading() {
                // Wait until both files are read.
                if (++filesRead < 2) {
                    return;
                }
                // The files should be the same size.
                t.is(resultImage.width, fixtureImage.width, 'image widths are the same');
                t.is(resultImage.height, fixtureImage.height, 'image heights are the same');
                // Do the visual diff.
                const diff = new pngjs_1.PNG({ width: resultImage.width, height: fixtureImage.height });
                const numDiffPixels = pixelmatch(resultImage.data, fixtureImage.data, diff.data, resultImage.width, resultImage.height, { threshold: 0.1 });
                if (numDiffPixels > 0) {
                    fs.writeFileSync(`${tempDir}/_DIFF-${fileName}.png`, pngjs_1.PNG.sync.write(diff));
                }
                // The files should look the same.
                t.is(numDiffPixels, 0, 'number of different pixels');
                resolve();
            }
        });
    }
};
//# sourceMappingURL=index.js.map