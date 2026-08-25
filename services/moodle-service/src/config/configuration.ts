export default () => ({
  port: parseInt(process.env.PORT ?? '3003', 10),
  nodeEnv: process.env.NODE_ENV ?? 'development',
  moodle: {
    baseUrl: process.env.MOODLE_BASE_URL ?? '',
    apiKey: process.env.MOODLE_API_KEY ?? '',
  },
});
