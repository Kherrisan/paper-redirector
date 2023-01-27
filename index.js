import Koa from 'koa';
import Router from 'koa-router';
import schedule from 'node-schedule';

const app = new Koa();
const router = new Router()

const scihubStatus = new Map();

schedule.scheduleJob('5 * * * * *', function () {
    console.log('The answer to life, the universe, and everything!');
});

const scihub = async (doi) => {

}

const arxiv = async (title) => {

}

router.get('/:payload', async ctx => {
    const payload = decodeURIComponent(ctx.params.payload);
    if (payload.indexOf('/') > -1) {
        // Payload is DOI code of the paper.

    } else {
        // Payload is title of the paper.
    }
})

router.get('/test', async ctx => {
    ctx.body = 'Hello World';
})

app.use(router.routes());
app.use(router.allowedMethods());
app.listen(3000);