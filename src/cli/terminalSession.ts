const enterAlternateScreen = "\u001b[?1049h\u001b[2J\u001b[H";
const leaveAlternateScreen = "\u001b[?1049l\u001b[2J\u001b[H";

export const runInAlternateTerminalScreen = async <T>(
  write: (sequence: string) => void,
  task: () => Promise<T>,
): Promise<T> => {
  write(enterAlternateScreen);
  try {
    return await task();
  } finally {
    write(leaveAlternateScreen);
  }
};
