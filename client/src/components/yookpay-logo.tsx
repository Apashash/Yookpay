interface YookPayLogoProps {
  size?: "sm" | "md" | "lg";
  className?: string;
}

const sizes = {
  sm: { img: "h-7 w-7",  text: "text-lg" },
  md: { img: "h-9 w-9",  text: "text-xl" },
  lg: { img: "h-14 w-14", text: "text-3xl" },
};

export function YookPayLogo({ size = "md", className = "" }: YookPayLogoProps) {
  const s = sizes[size];
  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      <img
        src="/logo.png"
        alt="YookPay logo"
        className={`${s.img} object-contain drop-shadow-sm flex-shrink-0`}
      />
      <span
        className={`${s.text} font-extrabold tracking-tight bg-gradient-to-r from-cyan-400 to-cyan-300 bg-clip-text text-transparent select-none`}
      >
        YookPay
      </span>
    </div>
  );
}
