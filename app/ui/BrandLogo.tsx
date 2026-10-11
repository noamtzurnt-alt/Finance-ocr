import Image from "next/image";

function cx(...xs: Array<string | false | null | undefined>) {
  return xs.filter(Boolean).join(" ");
}

export default function BrandLogo(props: {
  size?: "xs" | "sm" | "md";
  className?: string;
  src?: string | null;
}) {
  const size = props.size ?? "md";
  const dim = size === "xs" ? 18 : size === "sm" ? 30 : 34;
  const src = props.src || "/noam-finance-bot.webp";
  const isRemote = src.startsWith("http://") || src.startsWith("https://");

  if (isRemote) {
    return (
      // Remote signed R2 URLs — plain img avoids next/image remotePatterns churn.
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt=""
        width={dim}
        height={dim}
        className={cx(
          "brand-logo",
          size === "xs" && "brand-logo-xs",
          size === "sm" && "brand-logo-sm",
          props.className,
        )}
        style={{ width: dim, height: dim, objectFit: "cover", borderRadius: "9999px" }}
      />
    );
  }

  return (
    <Image
      src={src}
      alt=""
      width={dim}
      height={dim}
      className={cx(
        "brand-logo",
        size === "xs" && "brand-logo-xs",
        size === "sm" && "brand-logo-sm",
        props.className,
      )}
      priority
    />
  );
}
