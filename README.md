# ui5-ts-codegen README

This is a Visual Studio Code plugin that generates typescript code for SAPUI5/OpenUI5 model classes.

## Features

Generate getters/setters and contextPath builders based on the defined data structure of the model.

# Why generate code?
UI5 models has helper functions like setProperty/getProperty to set and get data. However, you would need to know the full data structure of each of your models before you even use it. To make it easier to maintain, this code generator would automatically create the getters and setters for each data on your model.

# Requirements
This script expects the following:
- you are using typescript on your project
- you have a base class that you use on all your models and this base class has a generic type argument defined. Example:
```
import JSONModel from "sap/ui/model/json/JSONModel";

/**
 * Interface representing the data used on the model.
 */
export interface ViewJSONModelData {
}

/**
 * Base class to use as JSONModel.
 *
 * @name mycompany.webdemo.models.ViewJSONModel
 */
export default abstract class ViewJSONModel<T extends ViewJSONModelData> extends JSONModel {
    constructor(oInitData: T ) {
        super(oInitData);
    }

    /**
     * Returns the entire data.
     */
    public getData() : T {
        // @ts-ignore
        return <T>super.getData();
    }
}
```

# Example model class and how it's used

## Model class example
Here's a basic example of a model class that is intended to hold data that will be used on our view:
```
import ViewJSONModel from "./ViewJSONModel";

export interface HomeViewJSONModelData {
    /** boolean flag that will be true if this view is waiting for data to load */
    loading: boolean,

    numDigits: Number,
    maxNumbers: Number,

    result: Number[],

    date?: Date,
    multiLevelData?: {
        key: string,
        obj: { num: number, str: string },
        valueList: {
            id: string,
            value: string
        }[]
    }
}

/**
 * Base class to use as JSONModel.
 *
 * @name spinifex.webdemo.models.HomeViewJSONModel
 */
export default class HomeViewJSONModel extends ViewJSONModel<HomeViewJSONModelData> {

    // will be prefilled with auto generated code at the bottom
}
```

## Using model class in a view
Normally when you work on the view, you need to know the full path of the data that you are binding on the model. But since the auto generated code has created all the functions for us, all possible data will have helper functions to tell the developer the properties that can be bound.
![](https://i.imgur.com/UIiLunU.gif)


## Using model class in a controller or any other class
Same with views, using model instances in controllers and other classes can be difficult unless the developer knows the entire data structure by heart. The generated code helps this by providing helper getters and setters with the correct data types already pre-filled.
![](https://i.imgur.com/B26KR5R.gif)

# Extension Settings

This extension contributes the following settings:

* `ui5-ts-codegen.parentClassName`: array of class names that will be treated as a JSONModel parent class; defaults to "ViewJSONModel" (see sample code above)

## Known Issues

This is still a WIP so please let me know if you encounter any issues.

## Release Notes

### 0.3.2
Update readme with samples and use cases

### 0.3.1
Fix issues due to incomplete deployment

### 0.1

Initial release

**Enjoy!**