const hasCookie = (name: string) =>
  document.cookie
    .split('; ')
    .find((row) => row.split('=')[0] === name)
    ?.split('=')[1];

export {hasCookie};
