#!/usr/bin/env python
# -*- coding: utf-8 -*-

"""
Adds EDI Data Repository query filter, defined in config.txt, to pasta.js and pasta_harvester.mjs

:Mod: main.py

:Author: Colin Smith

:Created: 2022-02-25
"""


import re
import os


def configure_catalog(path):
    """
    Parse user supplied configuration file and add parameters to pasta.js and pasta_harvester.mjs
    :param path: Path to configuration file
    :return: None
    """
    with open(path, 'r') as f:
        config = f.read().splitlines()

    with open('public/pasta.js', 'r+') as f:
        txt = f.read()
        for line in config:
            param = re.split(' = ', line)
            if any(x in param[0] for x in ['filter', 'limit']):
                txt = re.sub('(?<="' + param[0] + '":\\s).+(?=,)', param[1], txt)
        f.seek(0)
        f.write(txt)
        f.truncate()

    with open('harvester/pasta_harvester.mjs', 'r+') as f:
        txt = f.read()
        for line in config:
            param = re.split(' = ', line)
            if 'filter' in param[0]:
                txt = re.sub('(?<="' + param[0] + '":\\s).+(?=,)', param[1], txt)
        txt
        f.seek(0)
        f.write(txt)
        f.truncate()

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

# def is_packageid(x):
#     """
#     Test if input is an EDI Data Package Identifier is in the format 'scope.identifier'
#     :param x: Input object
#     :return: True if input has the format of a data package identifier, otherwise False
#     """
#     pat = '(^edi+\.[0-9]+$)|(^knb-lter-[a-z]+\.[0-9]+$)'
#     match = re.search(pat, x)
#     if match:
#         return True
#     else:
#         return False


def main():
    configure_catalog('config.txt')
    return 0


if __name__ == '__main__':
    main()
