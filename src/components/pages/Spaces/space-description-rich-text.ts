const TABLE_CLASS_NAMES = [
  '[&_table]:w-full [&_table]:border [&_table]:border-border/70 [&_table]:border-collapse [&_table]:rounded-md',
  '[&_th]:border [&_th]:border-border/70 [&_th]:bg-muted/60 [&_th]:px-2 [&_th]:py-1 [&_th]:text-left [&_th]:font-semibold',
  '[&_td]:border [&_td]:border-border/70 [&_td]:px-2 [&_td]:py-1 [&_td]:align-top'
] as const;

export const SPACE_DESCRIPTION_EDITOR_CLASSES = [
  'prose prose-sm max-w-full focus-visible:outline-none',
  '[&_p]:m-0',
  '[&_h1]:m-0 [&_h1]:text-2xl [&_h1]:font-semibold',
  '[&_h2]:m-0 [&_h2]:text-xl [&_h2]:font-semibold',
  '[&_h3]:m-0 [&_h3]:text-lg [&_h3]:font-semibold',
  '[&_ul]:list-disc [&_ul]:pl-6 [&_ul]:marker:text-muted-foreground',
  '[&_ol]:list-decimal [&_ol]:pl-6 [&_li]:my-1',
  ...TABLE_CLASS_NAMES
] as const;

export const SPACE_DESCRIPTION_VIEWER_CLASSES = [
  'prose prose-sm max-w-none',
  'text-muted-foreground',
  '[&_p]:text-muted-foreground',
  '[&_li]:text-muted-foreground',
  '[&_strong]:text-foreground',
  '[&_h1]:text-foreground [&_h1]:text-2xl [&_h1]:font-semibold',
  '[&_h2]:text-foreground [&_h2]:text-xl [&_h2]:font-semibold',
  '[&_h3]:text-foreground [&_h3]:text-lg [&_h3]:font-semibold',
  '[&_a]:text-primary [&_a]:underline [&_a]:underline-offset-2 hover:[&_a]:text-primary/80',
  ...TABLE_CLASS_NAMES
] as const;

export const SPACE_DESCRIPTION_VIEWER_CLASSNAME = SPACE_DESCRIPTION_VIEWER_CLASSES.join(' ');
export const SPACE_DESCRIPTION_EDITOR_CLASSNAME = SPACE_DESCRIPTION_EDITOR_CLASSES.join(' ');
