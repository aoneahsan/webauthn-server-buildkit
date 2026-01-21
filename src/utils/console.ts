const isProduction = process.env['NODE_ENV'] === 'production' || false;

export const consoleError = (data: unknown) => {
  if (isProduction) return;
  console.error(data);
};

export const consoleLog = (data: unknown) => {
  if (isProduction) return;
  // eslint-disable-next-line no-console
  console.log(data);
};

export const consoleWarn = (data: unknown) => {
  if (isProduction) return;
  console.warn(data);
};

export const consoleInfo = (data: unknown) => {
  if (isProduction) return;
  // eslint-disable-next-line no-console
  console.info(data);
};

export const consoleDir = (data: unknown) => {
  if (isProduction) return;
  // eslint-disable-next-line no-console
  console.dir(data);
};
