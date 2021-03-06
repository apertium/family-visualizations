#!/usr/bin/env python3
"""Usage: python3 <name>.py [-s] [-u] [-v] [-q] FAMILY
   Output: Outputs data (necessary for the family visualizer) for languages in FAMILY to json files
"""

from collections import Counter
from pathlib import Path
import xml.etree.ElementTree as etree
import argparse
import re
import logging
import json
import os
import subprocess
import shutil
import requests

from lexccounter import countStems as countLexcStems
from dixcounter import get_info as countDixStems

SCRAPERS_DIR = Path(__file__).absolute().parent
ROOT_DIR = SCRAPERS_DIR.parent
JSON_DIR = ROOT_DIR.joinpath("json")
REPOS_DIR = SCRAPERS_DIR.joinpath("git-repos")

pairLocations = ["incubator", "nursery", "staging", "trunk"]
langLocations = ["languages", "incubator"]


def rmPrefix(word):
    """Removes the apertium- prefix"""
    return word[len("apertium-") :]


def prepRepo(repo):
    """Adds repo if it doesn't exist, or updates it if does, and copies .mailmap to it"""
    if not REPOS_DIR.joinpath(repo).exists():
        logging.getLogger("prepRepo").info("Cloning %s...", repo)
        # Replaces the multi-line git clone status check with a single-line message
        subprocess.call(
            ["git", "clone", "--quiet", "https://github.com/apertium/{}".format(repo),],
            cwd=REPOS_DIR,
        )
    else:
        subprocess.call(
            ["git", "pull", "--force", "--quiet",], cwd=REPOS_DIR.joinpath(repo),
        )
    try:
        shutil.copyfile(
            SCRAPERS_DIR.joinpath(".mailmap"), REPOS_DIR.joinpath(repo, ".mailmap"),
        )
    except FileNotFoundError:
        # Better error message if a language wasn't found
        raise Exception(
            "Unable to clone {}. Please check if {} is a valid Apertium language and remove it from the json file if it isn't".format(
                repo, rmPrefix(repo)
            )
        )


def fileExt(repo):
    """Returns the extension of the dictionary.
    Useful for monolinguals, that can have a .lexc, .dix or .metadix extension"""
    for file in sorted(
        REPOS_DIR.joinpath("apertium-{0}".format(repo)).glob(
            "apertium-{0}.{0}.*".format(repo)
        )
    ):
        if file.suffix in (".lexc", ".dix", ".metadix"):
            return file.suffix.replace(".", "")
    return "unknown"


def monoHistory(language):
    """Returns the history of a monolingual dictionary"""
    dirName = "apertium-{}".format(language)
    try:
        oldFile = json.load(open(JSON_DIR.joinpath("{}.json".format(language)), "r", encoding="utf-8"))
        for data in oldFile:
            if data["name"] == language:
                history = data["history"]
                break
            history = []
    except (FileNotFoundError, json.decoder.JSONDecodeError):
        history = []
    prepRepo(dirName)
    extension = fileExt(language)
    commits = (
        subprocess.check_output(
            [
                "git",
                "log",
                "--format=%H<>%aN<>%aI<>",
                "--name-only",
                "--follow",
                "apertium-{0}.{0}.{1}".format(language, extension),
            ],
            cwd=REPOS_DIR.joinpath(dirName),
        )
        .decode("utf-8")
        .replace("\n\n", "")
        .split("\n")
    )

    commits.pop()  # last line is always empty
    for commit in commits:
        data = commit.split("<>")
        commitData = {
            "sha": data[0],
            "author": data[1],
            "date": data[2],
        }

        if any(commitData["sha"] == cm["sha"] for cm in history):
            continue

        fileURL = "https://raw.githubusercontent.com/apertium/apertium-{}/{}/{}".format(
            language, commitData["sha"], data[3].strip()
        )
        dataFile = requests.get(fileURL)

        if extension == "lexc":
            try:
                stems = countLexcStems(dataFile.text)
            except SystemExit:
                logging.getLogger("monoHistory").debug(
                    "DEBUG:monoHistory:Unable to count lexc stems for %s in commit %s",
                    language,
                    commitData["sha"],
                )
                continue
        else:
            stems = countDixStems(fileURL, False)
            if stems == -1:
                logging.getLogger("monoHistory").debug(
                    "DEBUG:monoHistory:Unable to count dix stems for %s in commit %s",
                    language,
                    commitData["sha"],
                )
                continue
            stems = stems["stems"]

        commitData["stems"] = stems
        history.append(commitData)

    return {"name": language, "history": history}


def pairHistory(language, languages, packages):
    """Returns the history of all pairs of a language"""
    langPackages = []
    for package in packages:
        if not (
            language in package["name"]
            and re.match(r"apertium-\w+-\w+", package["name"])
        ):
            continue

        dirName = package["name"]
        pairName = rmPrefix(dirName)
        pairList = pairName.split("-")
        if (
            not set(pairList) <= set(languages) or pairName == "ita-srd"
        ):  # This repo exists as srd-ita and ita-srd is empty
            continue

        logging.getLogger("pairHistory").info("Getting commits for %s...", dirName)

        prepRepo(dirName)
        dixName = (
            pairName if pairName != "tat-kir" else "tt-ky"
        )  # The tat-kir bidix is still named according to iso639-1 standards

        commits = (
            subprocess.check_output(
                [
                    "git",
                    "log",
                    "--format=%H<>%aN<>%aI<>",
                    "--name-only",
                    "--follow",
                    "apertium-{0}.{0}.dix".format(dixName),
                ],
                cwd=REPOS_DIR.joinpath(dirName),
            )
            .decode("utf-8")
            .replace("\n\n", "")
            .split("\n")
        )

        try:
            oldFile = json.load(
                open(JSON_DIR.joinpath("{}.json".format(language)), "r", encoding="utf-8")
            )
            for data in oldFile:
                if data["name"] == pairName:
                    history = data["history"]
                    break
                history = []
        except (FileNotFoundError, json.decoder.JSONDecodeError):
            history = []

        commits.pop()  # Last line is always empty
        for commit in commits:
            data = commit.split("<>")
            commitData = {
                "sha": data[0],
                "author": data[1],
                "date": data[2],
            }

            if any(commitData["sha"] == cm["sha"] for cm in history):
                continue

            dixFile = "https://raw.githubusercontent.com/apertium/apertium-{}/{}/{}".format(
                pairName, commitData["sha"], data[3]
            )
            stems = countDixStems(dixFile, True)
            if stems == -1:
                logging.getLogger("pairHistory").debug(
                    "DEBUG:pairHistory:Unable to count dix stems for %s in commit %s",
                    pairName,
                    commitData["sha"],
                )
                continue

            commitData["stems"] = stems["stems"]
            history.append(commitData)

        langPackages.append({"name": pairName, "history": history})
    return langPackages


def monoData(packages, languages, langFamily, updatemailmap):
    """Returns data for all monolingual dictionaries: state, stems, location and contributors"""
    data = []
    for package in packages:
        if not (
            re.match(r"apertium-\w+$", package["name"])
            and rmPrefix(package["name"]) in languages
        ):
            continue

        dirName = package["name"]
        language = rmPrefix(dirName)
        prepRepo(dirName)
        extension = fileExt(language)
        if extension == "lexc":
            fileType = extension
        elif extension == "dix":  # extension is dix, but type is monodix
            fileType = "monodix"
        else:
            fileType = "metamonodix"  # extension is metadix, but type is metamonodix

        try:
            stats = requests.get(
                "https://apertium.projectjj.com/stats-service/{}/{}/".format(
                    dirName, fileType
                )
            ).json()["stats"]
        except KeyError:
            raise Exception(
                "The stats-service seems to be updating at the moment. Please try again later"
            )
            # Raises an exception because the script can't continue
        for statistic in stats:
            if statistic["stat_kind"] == "Stems":
                stems = statistic["value"]
                break
        for topic in package["topics"]:
            if rmPrefix(topic) in langLocations:
                location = rmPrefix(topic)
                break

        lines = subprocess.check_output(
            [
                "git",
                "log",
                "--format=%aN",
                "--follow",
                "apertium-{0}.{0}.{1}".format(language, extension),
            ],
            cwd=REPOS_DIR.joinpath(dirName),
        ).decode("utf-8")

        if updatemailmap:
            commiters = (
                subprocess.check_output(
                    [
                        "git",
                        "log",
                        "--format=<%aE> %aN %cI %h",
                        "--follow",
                        "apertium-{0}.{0}.{1}".format(language, extension),
                    ],
                    cwd=REPOS_DIR.joinpath(dirName),
                )
                .decode("utf-8")
                .split("\n")
            )
            mailmap = open(
                SCRAPERS_DIR.joinpath(".mailmap"), "r", encoding="utf-8"
            ).read()
            for commiter in commiters:
                if not commiter.split(" ")[0] in mailmap:
                    print(commiter.encode("utf-8"), language)

        authors = lines.split("\n")
        authors.pop()  # last line is always empty
        contributors = []
        authorCount = Counter(authors)
        for contributor, count in authorCount.items():
            contributors.append({"user": contributor, "value": count})

        wikiURL = "http://wiki.apertium.org/wiki/" + langFamily + "_languages"
        wikiData = requests.get(wikiURL).text
        rows = etree.fromstring(
            wikiData, parser=etree.XMLParser(encoding="utf-8")
        ).find(
            ".//table[@class='wikitable sortable']"
        )  # The transducers table is always the first with this class

        stateCol = 6
        if langFamily == "celtic":  # Celtic's state cell is in a different column
            stateCol = 7

        for row in rows[2:]:  # ignores the header rows
            if rmPrefix(row[0][0][0].text) == language:  # name cell
                state = row[stateCol].text.strip()  # state cell
                break
            state = "unknown"

        data.append(
            {
                "lang": language,
                "state": state,
                "stems": stems,
                "location": "{} ({})".format(dirName, location),
                "contributors": contributors,
            }
        )

    return data


def pairData(packages, languages):
    """Returns the locations and stems of all specified pairs"""
    data = []
    for package in packages:
        if not re.match(r"apertium-\w+-\w+", package["name"]):
            continue

        pairName = rmPrefix(package["name"])
        pairSet = set(pairName.split("-"))
        if (
            not pairSet <= set(languages) or pairName == "ita-srd"
        ):  # This repo exists as srd-ita and ita-srd is empty
            continue
        for topic in package["topics"]:
            if rmPrefix(topic) in pairLocations:
                location = rmPrefix(topic)
                break

        try:
            stats = requests.get(
                "https://apertium.projectjj.com/stats-service/apertium-{}/bidix".format(
                    pairName
                )
            ).json()["stats"]
        except KeyError:
            raise Exception(
                "The stats-service seems to be updating at the moment. Please try again later"
            )
            # Raises an exception because the script can't continue

        for statistic in stats:
            if statistic["stat_kind"] == "Entries":
                stems = statistic["value"]
                break
        data.append({"langs": list(pairSet), "location": location, "stems": stems})

    return data


if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        description="Scrape data necessary for the visualizer of the specified family"
    )
    parser.add_argument(
        "-s",
        "--shallow",
        help="faster mode, doesn't dig through histories",
        action="store_true",
    )
    parser.add_argument(
        "-u",
        "--updatemailmap",
        help="outputs users that aren't on .mailmap",
        action="store_true",
    )
    parser.add_argument(
        "-q",
        "--quiet",
        help="stop the script from logging status updates",
        action="store_true",
    )
    parser.add_argument(
        "-v",
        "--verbose",
        help="log info about commits where the stems were unable to be counted",
        action="store_true",
    )
    parser.add_argument(
        "family", help="Family to scrape from",
    )
    args = parser.parse_args()

    FORMAT = "%(message)s"  # Prevents the info about the logger level
    if args.quiet:
        logging.basicConfig(level=logging.CRITICAL, format=FORMAT)
    elif args.verbose:
        logging.basicConfig(level=logging.DEBUG, format=FORMAT)
    else:
        logging.basicConfig(level=logging.INFO, format=FORMAT)

    # As this script already handles errors for the lexcccounter, disable logging for it:
    logging.getLogger("countStems").disabled = True
    logging.getLogger("requests").setLevel(logging.CRITICAL)
    logging.getLogger("urllib3").setLevel(logging.CRITICAL)

    family = args.family.lower()
    families = json.load(open(SCRAPERS_DIR.joinpath("families.json"), "r"), encoding="utf-8")
    try:
        langs = families[family]
    except KeyError:
        raise Exception(
            "The family you specified is not in the families.json file.\nPlease choose another family or add the family to the file"
        )

    if not REPOS_DIR.exists():
        os.mkdir(REPOS_DIR)

    allPackages = requests.get(
        "https://apertium.projectjj.com/stats-service/packages"
    ).json()["packages"]
    pairsFile = open(
        JSON_DIR.joinpath("{}_pairData.json".format(family)), "w+", encoding="utf-8",
    )
    logging.getLogger("").info(
        "Scraping pair data for %s languages...", family.capitalize()
    )
    json.dump(pairData(allPackages, langs), pairsFile, ensure_ascii=False)
    langsFile = open(
        JSON_DIR.joinpath("{}_transducers.json".format(family)), "w+", encoding="utf-8",
    )
    logging.getLogger("").info(
        "Scraping monolingual data for %s languages...", family.capitalize(),
    )
    json.dump(
        monoData(allPackages, langs, family, args.updatemailmap),
        langsFile,
        ensure_ascii=False,
    )
    if not args.shallow:
        for lang in langs:
            langHistory = []
            logging.getLogger("").info("Getting commits for apertium-%s...", lang)
            langHistory.append(monoHistory(lang))
            langHistory.extend(pairHistory(lang, langs, allPackages))
            outputFile = open(
                JSON_DIR.joinpath("{}.json".format(lang)), "w+", encoding="utf-8",
            )
            json.dump(langHistory, outputFile, ensure_ascii=False)
    # Print, as this should be here even with quiet mode
    print("\nSuccesfully scraped data for {} languages!".format(family.capitalize()))
