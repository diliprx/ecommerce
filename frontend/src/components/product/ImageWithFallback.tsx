"use client";

import Image from 'next/image';
import { useState, useCallback } from 'react';
import type { ImageProps } from 'next/image';

interface Props extends Omit<ImageProps, 'onError' | 'onLoad'> {
  fallbackSrc?: string;
  alt: string;
}

export function ImageWithFallback({
  src,
  fallbackSrc = `https://picsum.photos/400/300?random=${Math.random().toString(36).slice(2)}`,
  alt,
  ...props
}: Props) {
  const [imgSrc, setImgSrc] = useState(src);
  const [isError, setIsError] = useState(false);

  const handleError = useCallback(() => {
    if (!isError) {
      setIsError(true);
      setImgSrc(fallbackSrc);
    }
  }, [fallbackSrc, isError]);

  const handleLoad = useCallback(() => {
    setIsError(false);
  }, []);

  return (
    <Image
      src={imgSrc || fallbackSrc}
      alt={alt}
      onError={handleError}
      onLoad={handleLoad}
      {...props}
    />
  );
}

