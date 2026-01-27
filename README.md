# ezCatalog

A customizable data catalog for users of the EDI Data Repository

[Live demo](https://clnsmth.github.io/ezCatalog/public/demo.html)

_ezCatalog is inspired by the [PASTA-JavaScript-Search-Client](https://github.com/BLE-LTER/PASTA-JavaScript-Search-Client) developed by Tim Whiteaker for the Long-Term Ecological Research Network (LTER)._

## Motivation

Researchers and organizations publishing data in the [EDI Repository](https://portal.edirepository.org/nis/home.jsp) may wish to create a searchable data catalog on their website. This project includes code supporting such functionality.

## Usage for Your Site

1. **Fork** this GitHub repository to your own account.
2. **Create a custom branch:** Locally or on GitHub, create a new branch (e.g., `research-site`) from the `main` branch. **Do all your configuration and deployment on this branch.** This keeps your `main` branch clean, allowing you to easily pull in future updates from the original ezCatalog repo without overwriting your work.
3. Once the repository is forked, go to **Actions** and enable GitHub Actions for your repository. This is a security requirement imposed by GitHub on forked repositories that include GitHub Action workflows.
4. **Initialize GitHub Pages** for your fork. Go to **Settings > Pages** and select **Source** to be "Deploy from a branch" and **Branch** to be your custom branch (e.g., `research-site`) and the `/root` folder.
5. Construct a filter query to identify your data in the EDI Repository and to be listed in your catalog using one of the following options:
   - **Unique Keyword** - A unique keyword identifying your research group and published in the metadata of each of your EDI data packages can be used as a filter. For example, the research lab of Cayelan Carey publishes data with the keyword "Carey Lab" and the filter query `'&fq=keyword:"Carey Lab"'` returns all their data.
   - **Data Package Identifiers** - A list of data package identifiers in the form _id:scope.identifier_. For example, `'&q=id:edi.23+id:edi.101+id:edi.845'`returns the newest versions of data packages: `edi.23`, `edi.101`, and `edi.845`.
   - **Scope** - For LTER only. The scope identifying your LTER site. For example, `'&fq=scope:knb-lter-cap'` returns all data of the Central Arizona-Phoenix LTER. 
6. Add the filter query to `config.txt` and commit the changes to your custom branch.
7. Use GitHub **Actions** to build your catalog with the [build_catalog](https://github.com/EDIorg/ezCatalog/blob/master/.github/workflows/build_catalog.yml) workflow. Go to **Actions** and under **Workflows** select **Build catalog**, then **Run workflow**. Wait for the workflow to complete, then click the **Live demo** page to see your catalog (it may take a few minutes to update). Subsequent pushes to your fork will automatically rerun the `build_catalog` workflow.  
8. Copy the HTML snippet below and paste it into the body of your webpage.

```

<iframe loading="lazy" src="https://EDIorg.github.io/ezCatalog/public/demo.html" scrolling="no" allow="fullscreen" width="100%" height="2700px"></iframe>

```

9.  Additional configuration can be done in `/public/pasta.js`. For example the abstract visibility can be toggled by changing the value of `showAbstracts`, and the length of the abstract can be set by changing the value of `abstractLimit`.

### Keeping Your Catalog Updated

To pull in the latest features or fixes from the main ezCatalog repository:

1.  Sync your fork's `main` branch with the `upstream` repository.
2.  Merge the updated `main` branch into your `research-site` branch.

To see an example of how to embed the catalog in a web page `<iframe>`, view the page source code of the [Jornada Basin LTER Data Catalog](https://lter.jornada.nmsu.edu/data-catalog/) or experiment using the W3Schools [HTML Tryit editor](https://www.w3schools.com/html/tryit.asp?filename=tryhtml_intro).

## Caveats

The success of search queries depends upon the metadata provided when submitting data to the EDI Data Repository.

## Support

Please contact support@edirepository.org for help setting up your catalog or resolving issues.

## Scope

ezCatalog is a basic data catalog. If interested in developing a more feature rich catalog, we recommend checking out the video on [Using the PASTA+ Search API to Create a Local Data Catalog](https://www.youtube.com/watch?v=LwCI9TKi-Pg&t=361s).

## Running Unit Tests

This project uses [Jest](https://jestjs.io/) for unit testing JavaScript code.

To run all tests:


```

npm test

```

Test files should be named with `.test.js` and placed alongside the code they test (e.g., `public/sample.test.js`).

For more information, see the [Jest documentation](https://jestjs.io/docs/getting-started).

