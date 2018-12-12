"""
Python script used to filter out the pairs in pairs.json.txt that do not contain
languages with coordinates in the tsv file
"""

import json

language_pairs = set()


def filter_pairs(filename, languages, altCodes):
    """
    Filters out any language that is not in
    the list of valid languages
    """

    global language_pairs

    pair_file = open(filename, "r")
    filtered = []
    for line in pair_file:
        if '[' in line:
            line = line[1:]
        if ']' in line:
            line = line[:-1]
        line = line.strip().split()

        lang1 = line[3][1:-2]
        lang2 = line[1][1:-2]

        if lang1 in altCodes and lang1 not in languages:
            lang1 = altCodes[lang1]
        if lang2 in altCodes and lang2 not in languages:
            lang2 = altCodes[lang2]

        if lang1 in languages and lang2 in languages and lang1 != lang2:
            if (lang1, lang2) not in language_pairs and (lang2, lang1) not in language_pairs:
                # Getting rid of last comma
                line[-1] = line[-1][:-1]
                line[1] = line[1][0] + lang2 + line[1][-2:]
                line[3] = line[3][0] + lang1 + line[3][-2:]
                joined = " ".join(line)
                filtered.append(joined)
                language_pairs.add((lang1, lang2))

    pair_file.close()
    return filtered


def get_languages_with_coords(filename):
    """
    Gets the languages with their coordinates
    on the Earth
    """

    lang_file = open(filename, "r")
    langDict = {}
    for line in lang_file:
        line = line.strip().split(",")
        lat, lon = float(line[1]), float(line[2])
        langDict[line[0]] = [lon, lat]
    lang_file.close()
    return langDict


def get_alternate_codes(filename):
    """
    Reads the alternate codes for languages from file
    and then returns a dict of that data
    """

    code_file = open(filename, 'r')
    code_str = code_file.read()
    code_file.close()
    return json.loads(code_str)

if __name__ == "__main__":
    langDict = get_languages_with_coords("apertium-languages.tsv")
    altCodes = get_alternate_codes('codes.json')
    filtered = filter_pairs("pairs.json.txt", langDict, altCodes)
    apertiumFile = open("apertiumPairs.json", "w")

    apertiumFile.write("{\n")
    apertiumFile.write('"type": "FeatureCollection",\n')
    apertiumFile.write('"pairs": [\n')
    for line in filtered[:-1]:
        apertiumFile.write("\t"+line+"\n")
        apertiumFile.write(",\n")

    apertiumFile.write("\t"+filtered[-1]+"\n")

    apertiumFile.write("]\n")
    apertiumFile.write("}")

    apertiumFile.close()

    apertiumFile2 = open("apertiumPoints.json", "w")
    apertiumFile2.write("{\n")
    apertiumFile2.write('"type": "FeatureCollection",\n')

    # Writing point coordinates
    apertiumFile2.write('"point_data": [\n')
    langArr = []
    for code in sorted(langDict.keys()):
        langArr.append([code, langDict[code]])

    for lang in langArr[:-1]:
        string = f'{{"type": "Feature", "tag": "{lang[0]}", "geometry": {{ "type": "Point", "coordinates": {lang[1]}}} }}\n'
        apertiumFile2.write("\t" + string)
        apertiumFile2.write(",\n")

    string = f'{{"type": "Feature", "tag": "{langArr[-1][0]}", "geometry": {{ "type": "Point", "coordinates": {langArr[-1][1]}}} }}\n'
    apertiumFile2.write("\t" + string)

    apertiumFile2.write("]\n")
    apertiumFile2.write("}")

    apertiumFile2.close()
