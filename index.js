import Koa from 'koa';
import Router from 'koa-router';
import schedule from 'node-schedule';
import Log4js from 'log4js';

const SCIHUB_MIRRORS = [
    'https://sci-hub.ru'
]

// const console = Log4js.getconsole();
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
    console.log('Checking Sci-Hub mirror status...');
    for (let mirror of SCIHUB_MIRRORS) {
        fetch(mirror).then(res => {
            if (res.status === 200) {
                console.log(`Sci-Hub mirror ${mirror} is online.`)
                scihubStatus.set(mirror, true);
            } else {
                console.log(`Sci-Hub mirror ${mirror} is offline.`)
                scihubStatus.set(mirror, false);
            }
        }).catch(err => {
            console.log(`Sci-Hub mirror ${mirror} is offline.`)
            scihubStatus.set(mirror, false);
        });
    }
}

const scihub = async (doi) => {
    console.log(`Searching ${doi} in Sci-Hub...`);
    const parallels = Promise.any(SCIHUB_MIRRORS.filter(mirror => scihubStatus.get(mirror)).map(mirror =>
        new Promise(async (resolve, reject) => {
            const url = `${mirror}/${doi}`;
            let res;
            try {
                res = await fetch(url, { headers: { 'Accept-language': 'zh-CN,zh;q=0.9,en;q=0.8' } });
            } catch (err) {
                console.log(`Sci-Hub mirror ${mirror} is offline.`);
                scihubStatus[mirror] = false;
                reject(err);
                return;
            }
            if (res.status !== 200) {
                console.log(`Sci-Hub mirror ${mirror} responded with status code ${res.status}.`);
                reject(res.statusText);
            }
            const text = await res.text();
            if (text.indexOf('未找到文章') > -1) {
                console.log(`${doi} is not found in Sci-Hub mirror ${mirror}.`);
                reject();
            } else {
                console.log(`Found ${doi} in Sci-Hub mirror ${mirror}: ${url}`)
                resolve(url);
            }
        })));
    try {
        const url = await parallels;
        if (url) {
            console.log(`Choosed Sci-Hub mirror ${url} to provide ${doi}.`)
            return url;
        } else {
            console.log(`No Sci-Hub mirror cound provide ${doi}.`)
            return null;
        }
    } catch (err) {
        console.log(`No Sci-Hub mirror cound provide ${doi}.`)
        return null;
    }
}

const arxiv = async (title) => {

}

router.get('/:payload', async ctx => {
    const payload = decodeURIComponent(ctx.params.payload).trim();
    if (payload.indexOf('/') > -1) {
        // Payload is DOI code of the paper.
        console.log(`Searching DOI: ${payload}...`);
        const url = await scihub(payload);
        if (url) {
            console.log(`Redirecting to ${url}...`);
            ctx.redirect(url);
        } else {
            ctx.body = 'Not found.';
            ctx.status = 404;
        }
    } else {
        // Payload is title of the paper.
    }
})

router.get('/other/status', async ctx => {
    ctx.body = JSON.stringify(Array.from(scihubStatus));
})

app.use(router.routes());
app.use(router.allowedMethods());
app.listen(3000);