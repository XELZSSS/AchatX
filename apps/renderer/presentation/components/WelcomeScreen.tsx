import { memo } from 'react';
import type { ReactNode } from 'react';

const CONTAINER_CLASS = 'flex-1 flex flex-col items-center justify-center p-4 min-h-[60vh]';
const INPUT_WRAPPER_CLASS = 'w-full max-w-[min(52rem,100%)]';

interface WelcomeScreenProps {
  input?: ReactNode;
}

const WelcomeScreen = ({ input }: WelcomeScreenProps) => {
  const inputContent = input ? <div className={INPUT_WRAPPER_CLASS}>{input}</div> : null;

  return <div className={CONTAINER_CLASS}>{inputContent}</div>;
};

const MemoizedWelcomeScreen = memo(WelcomeScreen);
export default MemoizedWelcomeScreen;
