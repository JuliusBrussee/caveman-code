import { defineConfig } from "astro/config";
import starlight from "@astrojs/starlight";

export default defineConfig({
    integrations: [
        starlight({
            title: "CAVE CLI",
            social: {
                github: "https://github.com/JuliusBrussee/caveman-cli",
            },
            sidebar: [
                { label: "Getting Started", items: [
                    { label: "Installation", slug: "getting-started/installation" },
                    { label: "Quick Start", slug: "getting-started/quickstart" },
                ]},
                { label: "Guides", autogenerate: { directory: "guides" } },
                { label: "Reference", autogenerate: { directory: "reference" } },
            ],
        }),
    ],
});
