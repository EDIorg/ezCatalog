# ezCatalog

A customizable data catalog for users of the EDI Data Repository

[Live demo](https://clnsmth.github.io/ezCatalog/public/demo.html)

_ezCatalog is based on the [PASTA-JavaScript-Search-Client](https://github.com/BLE-LTER/PASTA-JavaScript-Search-Client) developed by Tim Whiteaker for the Long-Term Ecological Research Network (LTER)._

## Motivation

Researchers and organizations publishing data in the [EDI Repository](https://portal.edirepository.org/nis/home.jsp) may wish to create a searchable data catalog on their website. This project includes code supporting such functionality.

## Usage for Your Site

1. Fork this GitHub repository. 
2. Initialize GitHub Pages for your fork. Go to **Settings > Pages** and select **Source** to be `/root` of the main branch.
3. Construct a filter query to identify your data in the EDI Repository and to be listed in your catalog using one of the following options:
   - **Unique Keyword**  - A unique keyword identifying your research group and published in the metadata of each of your EDI data packages can be used as a filter. For example, the research lab of Cayelan Carey publishes data with the keyword "Carey Lab" and the filter query `'&fq=keyword:"Carey Lab"'` returns all their data.
   - **Data Package Identifiers** - A list of data package identifiers in the form _id:scope.identifier_. For example, `'&q=id:edi.23+id:edi.101+id:edi.845'`returns the newest versions of data packages: `edi.23`, `edi.101`, and `edi.845`.
   - **Scope** - For LTER only. The scope identifying your LTER site. For example, `'&fq=scope:knb-lter-cap'` returns all data of the Central Arizona-Phoenix LTER. 
4. Add the filter query to `config.txt` and commit the changes.
5. Enable GitHub Actions to build your catalog with the [build_catalog](https://github.com/clnsmth/ezCatalog/blob/master/.github/workflows/build_catalog.yml) workflow. Go to **Actions** and enable. Under **Workflows** select **Build catalog**, then **Run workflow**. Wait for the workflow to complete, then click the **Live demo** page to see your catalog (it may take a few minutes to update). Subsequent pushes to your fork will automatically rerun the `build_catalog` workflow.  
6. Copy the HTML snippet below and paste it into the body of your webpage. This will reference the catalog hosted on GitHub Pages from within your website.
```
<iframe loading="lazy" src="https://clnsmth.github.io/ezCatalog/public/demo.html" scrolling="no" allow="fullscreen" width="100%" height="2700px"></iframe>
```

View the page source code of the [Jornada Basin LTER Data Catalog](https://lter.jornada.nmsu.edu/data-catalog/) for an example of embedding an <iframe> in a webpage or experiment using the W3Schools [HTML Tryit editor](https://www.w3schools.com/html/tryit.asp?filename=tryhtml_intro).

## Features

### Autocomplete

Autocomplete is currently supported for the creator and taxonomy input fields. Try typing a couple of characters into the creator box of the demo page and see what happens.

Autocomplete requires creating a list of possible choices, which is automatically generated each time the GitHub Actions workflow `build_catalog` runs.

### Pagination

ezCatalog allows you to limit the number of results returned per page. If you do not wish to use pagination, set the `limit` parameter in `config.txt` to a number higher than the number of datasets available for your group.

## Caveats

The success of search queries depends upon the metadata provided when submitting data to the EDI Data Repository.

## Support

Please contact support@edirepository.org for help setting up your catalog or resolving issues.

## Scope
   
ezCatalog is a basic data catalog. If interested in developing a more feature rich catalog, we recommend checking out the video on [Using the PASTA+ Search API to Create a Local Data Catalog](https://www.youtube.com/watch?v=LwCI9TKi-Pg&t=361s).
   
## Acknowledgments

CSV export uses uselesscode's JS CSV serializer (MIT Licensed):
http://www.uselesscode.org/javascript/csv/

We use Pixabay's autocomplete plugin. Thanks Pixabay!
