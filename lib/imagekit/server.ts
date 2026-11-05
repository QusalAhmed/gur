import ImageKit from "imagekit";

let imagekitInstance: ImageKit | null = null;

/**
 * Returns a singleton ImageKit instance for server-side operations.
 * Validates that all required environment variables are configured.
 */
export function getImageKitServer(): ImageKit {
  if (imagekitInstance) return imagekitInstance;

  const publicKey = process.env.NEXT_PUBLIC_IMAGEKIT_PUBLIC_KEY;
  const privateKey = process.env.IMAGEKIT_PRIVATE_KEY;
  const urlEndpoint = process.env.NEXT_PUBLIC_IMAGEKIT_URL_ENDPOINT;

  if (!publicKey || !privateKey || !urlEndpoint || publicKey.includes("your_public_key") || privateKey.includes("your_private_key")) {
    throw new Error(
      "ImageKit configuration is missing or using placeholder values. Please set NEXT_PUBLIC_IMAGEKIT_PUBLIC_KEY, IMAGEKIT_PRIVATE_KEY, and NEXT_PUBLIC_IMAGEKIT_URL_ENDPOINT in your .env file."
    );
  }

  imagekitInstance = new ImageKit({
    publicKey,
    privateKey,
    urlEndpoint,
  });

  return imagekitInstance;
}

/**
 * Helper to check if ImageKit is configured in the current environment
 */
export function isImageKitConfigured(): boolean {
  const publicKey = process.env.NEXT_PUBLIC_IMAGEKIT_PUBLIC_KEY;
  const privateKey = process.env.IMAGEKIT_PRIVATE_KEY;
  const urlEndpoint = process.env.NEXT_PUBLIC_IMAGEKIT_URL_ENDPOINT;

  return Boolean(
    publicKey &&
    privateKey &&
    urlEndpoint &&
    !publicKey.includes("your_public_key") &&
    !privateKey.includes("your_private_key")
  );
}

