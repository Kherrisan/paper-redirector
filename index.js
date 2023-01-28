import Koa from 'koa';
import Router from 'koa-router';
import schedule from 'node-schedule';
import Log4js from 'log4js';
import axios from 'axios';
import { load } from 'cheerio';

const SCIHUB_MIRRORS = [
    'https://sci-hub.ru'
]

const logger = Log4js.getLogger('paper-redirector');
logger.level = 'debug';
const app = new Koa();
const router = new Router()

const scihubStatus = new Map();
for (let mirror of SCIHUB_MIRRORS) {
    scihubStatus.set(mirror, true);
}

schedule.scheduleJob('5 * * * * *', function () {
    checkSciHubMirror();
});

const checkSciHubMirror = () => {
    logger.log('Checking Sci-Hub mirror status...');
    for (let mirror of SCIHUB_MIRRORS) {
        fetch(mirror).then(res => {
            if (res.status === 200) {
                logger.log(`Sci-Hub mirror ${mirror} is online.`)
                scihubStatus.set(mirror, true);
            } else {
                logger.log(`Sci-Hub mirror ${mirror} is offline.`)
                scihubStatus.set(mirror, false);
            }
        }).catch(err => {
            logger.log(`Sci-Hub mirror ${mirror} is offline.`)
            scihubStatus.set(mirror, false);
        });
    }
}

const scihub = async (doi) => {
    logger.log(`Searching ${doi} in Sci-Hub...`);
    const parallels = Promise.any(SCIHUB_MIRRORS.filter(mirror => scihubStatus.get(mirror)).map(mirror =>
        new Promise(async (resolve, reject) => {
            const url = `${mirror}/${doi}`;
            let res;
            try {
                res = await fetch(url, { headers: { 'Accept-language': 'zh-CN,zh;q=0.9,en;q=0.8' } });
            } catch (err) {
                logger.warn(`Sci-Hub mirror ${mirror} is offline.`);
                scihubStatus[mirror] = false;
                reject(err);
                return;
            }
            if (res.status !== 200) {
                logger.log(`Sci-Hub mirror ${mirror} responded with status code ${res.status}.`);
                reject(res.statusText);
            }
            const text = await res.text();
            if (text.indexOf('未找到文章') > -1) {
                logger.warn(`${doi} is not found in Sci-Hub mirror ${mirror}.`);
                reject();
            } else {
                logger.log(`Found ${doi} in Sci-Hub mirror ${mirror}: ${url}`)
                resolve(url);
            }
        })));
    try {
        const url = await parallels;
        if (url) {
            logger.log(`Choosed Sci-Hub mirror ${url} to provide ${doi}.`)
            return url;
        } else {
            logger.error(`No Sci-Hub mirror cound provide ${doi}.`)
            return null;
        }
    } catch (err) {
        logger.error(`No Sci-Hub mirror cound provide ${doi}.`)
        return null;
    }
}

const arxiv = async (title) => {

}

const researchGate = async (title) => {
    let resp = await axios.get(`https://www.researchgate.net/search/publication?q=${encodeURIComponent(title)}`);
    const $ = load(resp.data);
    const candidates = $('div[itemtype="http://schema.org/ScholarlyArticle"]')
        .filter((div) => $(div).find('a').first().text().trim() === title);
    if (candidates.length === 0) {
        return null;
    }
    const div = candidates[0];
    if (div.text().indexOf('DOI') > -1) {
        return {
            div.text().match(/DOI: (.*)/)[1],
        }
    }
    const href = $(candidates[0]).find('a').first().attr('href');
    resp = await axios.get(`https://www.researchgate.net/${href}`);
}

const googleScholar = (title) => `https://scholar.google.com/scholar?q=${encodeURIComponent(title)}`

router.get('/:payload', async ctx => {
    const payload = decodeURIComponent(ctx.params.payload).trim();
    let url;
    if (payload.indexOf('/') > -1) {
        // Payload is DOI code of the paper.
        logger.debug(`Searching DOI: ${payload}...`);
        url = await scihub(payload);
    } else {
        // Payload is title of the paper.
        logger.debug(`Searching title: ${payload}...`);
        url = await arxiv(payload);
    }
    if (url) {
        logger.log(`Redirecting to ${url}...`);
        ctx.redirect(url);
    } else {
        ctx.body = 'Not found.';
        ctx.status = 404;
    }
})

router.get('/other/status', async ctx => {
    ctx.body = JSON.stringify(Object.fromEntries(scihubStatus));
})

app.use(router.routes());
app.use(router.allowedMethods());

logger.log('Starting server...');
app.listen(3000);