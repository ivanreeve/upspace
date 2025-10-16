import Image from "next/image";

export function Features() {
  return (
    <div
      id='features'
      className='w-full min-h-[1024px] flex items-center justify-start py-24 lg:py-32'
    >
      <div className='max-w-6xl w-full flex flex-col-reverse lg:flex-row items-center lg:items-start justify-start gap-14 px-6'>
        {/* Right container - Hidden on mobile */}
        <div className="relative hidden lg:flex flex-none w-[640px] items-center justify-center bg-background h-[500px] overflow-hidden">
          <Image
            src="/img/feature-light-1.svg"
            alt="Find and Book Spaces"
            sizes="(min-width: 1024px) 50vw, 100vw"
            fill
            priority
            className='object-contain dark:hidden'
          />
          <Image
            src="/img/feature-dark-1.svg"
            alt="Find and Book Spaces"
            sizes="(min-width: 1024px) 50vw, 100vw"
            fill
            className='hidden object-contain dark:block'
          />
        </div>

        <div className="flex-1 flex flex-col items-center lg:items-start gap-5 text-center lg:text-left w-full lg:max-w-3xl">
          <h1 className="text-[3.25rem] lg:text-[3.5rem] font-instrument-serif leading-tight">
            Discover and Book Coworking Spaces
          </h1>
          <p className="text-lg lg:text-xl max-w-2xl">
            This is a description of the features of the product. It highlights the key functionalities and benefits that users can expect.
          </p>
        </div>
      </div>
    </div>
  );
}
