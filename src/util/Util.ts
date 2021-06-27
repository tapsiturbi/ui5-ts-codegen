

export default class Util {
    /**
     * Converts string to camel case ("hello" => "Hello"; "helloWorld" => "HelloWorld")
     * @param {*} str
     */
    public static toCamelCase(str:string) {
        return str.charAt(0).toUpperCase() + str.substr(1);
    }

    /**
     * Returns the number of occurrences of word in origStr.
     * @param origStr 
     * @param word 
     */
    public static countOccurrences(origStr:string, word:string) {
        return origStr.split(word).length - 1;
    }
}