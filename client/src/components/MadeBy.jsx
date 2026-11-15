// A small signature at the bottom of every page: the name shimmers slowly and glows on hover
export default function MadeBy() {
  return (
    <p className="group flex items-center justify-center gap-3 text-xs tracking-wide text-faint">
      <span
        className="h-px w-8 bg-linear-to-r from-transparent to-line-strong transition-all duration-500 group-hover:w-16 group-hover:to-brand"
        aria-hidden="true"
      />
      <span>
        Designed &amp; built by{" "}
        <a
          href="https://github.com/vanjulT"
          target="_blank"
          rel="noreferrer"
          className="signature text-sm font-semibold transition-[filter] duration-300 hover:drop-shadow-[0_0_10px_rgba(34,211,238,0.6)]"
        >
          Vanjul Thakur
        </a>
      </span>
      <span
        className="h-px w-8 bg-linear-to-l from-transparent to-line-strong transition-all duration-500 group-hover:w-16 group-hover:to-brand"
        aria-hidden="true"
      />
    </p>
  );
}
