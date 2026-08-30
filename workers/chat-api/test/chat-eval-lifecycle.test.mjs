import assert from 'node:assert/strict';
import http from 'node:http';
import test from 'node:test';

test('chat evaluator keeps module evaluation alive through all six questions', async () => {
  let requestCount = 0;
  let answerCount = 0;
  let finishAnswers;
  const answersFinished = new Promise((resolve) => {
    finishAnswers = resolve;
  });
  const server = http.createServer((_request, response) => {
    requestCount += 1;
    response.writeHead(200, { 'content-type': 'application/json' });
    response.end(JSON.stringify({ answer: `Mock answer ${requestCount}` }));
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));

  const address = server.address();
  assert.notEqual(address, null);
  assert.equal(typeof address, 'object');
  const endpoint = `http://127.0.0.1:${address.port}/api/chat`;
  const originalArgv = process.argv;
  const originalLog = console.log;
  const originalError = console.error;
  let requestsWhenModuleResolved = -1;

  try {
    process.argv = [process.execPath, 'scripts/chat-eval.mjs', '--url', endpoint];
    console.log = (...values) => {
      if (String(values[0]).startsWith('Answer:')) {
        answerCount += 1;
        if (answerCount === 6) finishAnswers();
      }
    };
    console.error = (...values) => {
      throw new Error(values.map(String).join(' '));
    };

    const evaluator = new URL('../../../scripts/chat-eval.mjs', import.meta.url);
    evaluator.searchParams.set('lifecycle-test', String(Date.now()));
    await import(evaluator.href);
    requestsWhenModuleResolved = requestCount;

    let timeout;
    try {
      await Promise.race([
        answersFinished,
        new Promise((_, reject) => {
          timeout = setTimeout(
            () => reject(new Error('Evaluator did not finish six answers.')),
            5_000,
          );
        }),
      ]);
    } finally {
      clearTimeout(timeout);
    }
  } finally {
    process.argv = originalArgv;
    console.log = originalLog;
    console.error = originalError;
    await new Promise((resolve, reject) => {
      server.close((error) => error === undefined ? resolve() : reject(error));
    });
  }

  assert.equal(requestsWhenModuleResolved, 6);
  assert.equal(requestCount, 6);
  assert.equal(answerCount, 6);
});
