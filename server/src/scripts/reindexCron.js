//src/scripts/reindexCron.js
const { reindexAll } = require('./reindex');
const cron = require('node-cron');

console.log('Starting reindex cron job...');

cron.schedule('*/30 * * * * *', async () => {  // Каждые 5 минут
  console.log('Running scheduled reindex...');
  try {
    await reindexAll();
    console.log('Scheduled reindex completed successfully');
  } catch (err) {
    console.error(`Scheduled reindex failed: ${err.message}`);
    console.log('Continuing to next scheduled reindex...');
  }
});

console.log('Reindex cron job scheduled (every 5 minutes)');