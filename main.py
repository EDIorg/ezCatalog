#!/usr/bin/env python
# -*- coding: utf-8 -*-

"""
Helps configure ezCatalog for users
"""


import re
import os


def configure_catalog():
    """
    Adds user GitHub name to link snippets in README.md
    :return: None
    """

    with open('README.md', 'r+') as f:
        txt = f.read()
        [owner, repository] = os.getenv('GITHUB_REPOSITORY').split('/')
        # Replace the old demo page with the new one
        new_demo_page = f"https://{owner}.github.io/{repository}/public/demo.html"
        txt = re.sub(f"https://EDIorg.github.io/ezCatalog/public/demo.html", new_demo_page, txt)
        # Replace the old build_catalog.yml URL with the new one
        new_url = f"https://github.com/{owner}/{repository}/blob/master/.github/workflows/build_catalog.yml"
        txt = re.sub(f"https://github.com/EDIorg/ezCatalog/blob/master/.github/workflows/build_catalog.yml", new_url, txt)
        f.seek(0)
        f.write(txt)
        f.truncate()

    return 0

def main():
    configure_catalog()
    return 0


if __name__ == '__main__':
    main()
