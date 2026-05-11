const {workerData, parentPort} = require('worker_threads');
const _ = require('lodash');
const realEstateCategoryService = require("../services/realEstateCategoryService");
const fs = require("fs");
const {stringify} = require("csv");
const realEstateStatusService = require("../services/realEstateStatusService");
const {httpGet} = require("../request/httpRequest");
const Constants = require("../common/constants");
const {ceil} = require("lodash/math");
const {} = workerData;
let message = "";
const AdmZip = require("adm-zip");
const zip = new AdmZip();
const {numberRealEstate} = workerData;
const {
    Parser,
    AsyncParser,
    transforms: {unwind},
} = require('json2csv');
const {delimiter} = require("path");
const prepareCategory = async (outputCategoryFilePath) => {


    const {realEstateCategoryList} = await realEstateCategoryService.getList({
        limit: 100
    });

    const outputCategory = fs.createWriteStream(outputCategoryFilePath, {
        encoding: 'utf8',
        flags: 'a',
    });
    const fields = [
        {label: 'Tiêu đề', value: 'title'},
    ]
    const asyncParser = new AsyncParser(
        {fields, withBOM: true, delimiter: ','},
        {
            highWaterMark: 8192,
            encoding: 'utf-8',
        },
    ).toOutput(outputCategory);
    let csv = '';
    asyncParser.processor
        .on('data', (chunk) => {
            csv += chunk.toString();
        })
        .on('end', () => {
            asyncParser.fromInput(csv);
            outputCategory.close();
        })
        .on('error', (err) => console.error(err));

    _.each(realEstateCategoryList, (category) => {
        asyncParser.input.push(JSON.stringify(category));
    })
    asyncParser.input.push(null);

}
const prepareStatus = async (outputStatusFilePath) => {

    const {realEstateStatusList} = await realEstateStatusService.getList({
        limit: 100
    });

    const outputStatus = fs.createWriteStream(outputStatusFilePath, {
        encoding: 'utf8',
        flags: 'a',
    });
    const fields = [
        {label: 'Tiêu đề', value: 'title'},
    ];

    const asyncParser = new AsyncParser(
        {fields, withBOM: true, delimiter: ','},
        {
            highWaterMark: 8192,
            encoding: 'utf-8',
        },
    ).toOutput(outputStatus);
    let csv = '';
    asyncParser.processor
        .on('data', (chunk) => {
            csv += chunk.toString();
        })
        .on('end', () => {
            asyncParser.fromInput(csv);
            outputStatus.close();
        })
        .on('error', (err) => console.error(err));

    _.each(realEstateStatusList, (status) => {
        asyncParser.input.push(JSON.stringify(status));
    })
    asyncParser.input.push(null);

}
const prepareProvince = async (outputProvinceFilePath) => {
    const outputProvince = fs.createWriteStream(outputProvinceFilePath, {
        encoding: 'utf8',
        flags: 'a',
    });
    const fields = [
        {label: 'Tỉnh/TP', value: 'title'},
    ];

    const asyncParser = new AsyncParser(
        {fields, withBOM: true, delimiter: ','},
        {
            highWaterMark: 8192,
            encoding: 'utf-8',
        },
    ).toOutput(outputProvince);

    let csv = '';
    asyncParser.processor
        .on('data', (chunk) => {
            csv += chunk.toString();
        })
        .on('end', () => {
            asyncParser.fromInput(csv);
            outputProvince.close();
        })
        .on('error', (err) => console.error(err));

    const limit = 100;
    const result = await httpGet(
        `${Constants.ADMINISTRATIVE_URL}/province/list`,
        {
            params: {
                limit: limit,
                status: [Constants.STATUS_ENUM.ACTIVE, Constants.STATUS_ENUM.PENDING]
            },
        },
    );
    const {data, total} = result.data;
    if (!_.isEmpty(data)) {
        const totalPage = ceil(total / limit);
        _.each(data, (province) => {
            asyncParser.input.push(JSON.stringify(province));
        })
        if (totalPage > 1) {
            for (let i = 2; i <= totalPage; i++) {
                let resultLoop = await loopProvince(
                    i,
                    limit,
                );
                const {data} = resultLoop.data;
                _.each(data, (province) => {
                    asyncParser.input.push(JSON.stringify(province));
                })
            }
        }
        asyncParser.input.push(null);
    }

}
const prepareDistrict = async (outputDistrictFilePath) => {
    const outputDistrict = fs.createWriteStream(outputDistrictFilePath, {
        encoding: 'utf8',
        flags: 'a',
    });
    const fields = [
        {label: 'Quận/Huyện', value: 'display_title'},
        {
            value: 'province_city.display_title',
            label: 'Tỉnh/TP'
        }
    ];

    const asyncParser = new AsyncParser(
        {fields, withBOM: true, delimiter: ','},
        {
            highWaterMark: 8192,
            encoding: 'utf-8',
        },
    ).toOutput(outputDistrict);

    let csv = '';
    asyncParser.processor
        .on('data', (chunk) => {
            csv += chunk.toString();
        })
        .on('end', () => {
            asyncParser.fromInput(csv);
            outputDistrict.close();
        })
        .on('error', (err) => console.error(err));

    const limit = 100;
    const result = await httpGet(
        `${Constants.ADMINISTRATIVE_URL}/district/list`,
        {
            params: {
                limit: limit,
                status: [Constants.STATUS_ENUM.ACTIVE, Constants.STATUS_ENUM.PENDING]
            },
        },
    );
    const {data, total} = result.data;
    if (!_.isEmpty(data)) {
        const totalPage = ceil(total / limit);
        _.each(data, (district) => {
            asyncParser.input.push(JSON.stringify(district));
        })
        if (totalPage > 1) {
            for (let i = 2; i <= totalPage; i++) {
                const resultLoop = await loopDistrict(
                    i,
                    limit,
                );
                const {data} = resultLoop.data;
                _.each(data, (district) => {
                    asyncParser.input.push(JSON.stringify(district));
                })
            }

        }
        asyncParser.input.push(null);
    }
}
const prepareWard = async (outputWardFilePath) => {
    const outputWard = fs.createWriteStream(outputWardFilePath, {
        encoding: 'utf8',
        flags: 'a',
    });
    const fields = [
        {label: 'Phường/xã', value: 'display_title'},
        {
            value: 'districts.display_title',
            label: 'Quận/Huyện'
        },
        {value: 'province_city.display_title', label: 'Tỉnh/TP'}
    ];
    const asyncParser = new AsyncParser(
        {fields, withBOM: true, delimiter: ','},
        {
            highWaterMark: 8192,
            encoding: 'utf-8',
        },
    ).toOutput(outputWard);
    let csv = '';
    asyncParser.processor
        .on('data', (chunk) => {
            csv += chunk.toString();
        })
        .on('end', () => {
            asyncParser.fromInput(csv);
            outputWard.close();
        })
        .on('error', (err) => console.error(err));

    const limit = 100;
    const result = await httpGet(
        `${Constants.ADMINISTRATIVE_URL}/ward/list`,
        {
            params: {
                limit: limit,
                status: [Constants.STATUS_ENUM.ACTIVE, Constants.STATUS_ENUM.PENDING]
            },
        },
    );
    const {data, total} = result.data;
    if (!_.isEmpty(data)) {
        const totalPage = ceil(total / limit);
        _.each(data, (ward) => {
            asyncParser.input.push(JSON.stringify(ward));
        })
        if (totalPage > 1) {
            for (let i = 2; i <= totalPage; i++) {
                let resultLoop = await loopWard(
                    i,
                    limit,
                );
                const {data} = resultLoop.data;
                _.each(data, (ward) => {
                    asyncParser.input.push(JSON.stringify(ward));
                })
            }

        }
        asyncParser.input.push(null);
    }
}
const prepareStreet = async (outputStreetFilePath) => {
    const outputStreet = fs.createWriteStream(outputStreetFilePath, {
        encoding: 'utf8',
        flags: 'a',
    });
    const fields = [
        {label: 'Đường', value: 'display_title'},
        {
            value: "wards.display_title",
            label: "Phường/xã"
        },
        {
            value: 'districts.display_title',
            label: 'Quận/Huyện'
        },
        {value: 'province_city.display_title', label: 'Tỉnh/TP'}
    ];

    const asyncParser = new AsyncParser(
        {fields, withBOM: true, delimiter: ','},
        {
            highWaterMark: 8192,
            encoding: 'utf-8',
        },
    ).toOutput(outputStreet);
    let csv = '';
    asyncParser.processor
        .on('data', (chunk) => {
            csv += chunk.toString();
        })
        .on('end', () => {
            asyncParser.fromInput(csv);
            outputStreet.close();
        })
        .on('error', (err) => console.error(err));

    const limit = 100;
    const result = await httpGet(
        `${Constants.ADMINISTRATIVE_URL}/street/list`,
        {
            params: {
                limit: limit,
                status: [Constants.STATUS_ENUM.ACTIVE, Constants.STATUS_ENUM.PENDING]
            },
        },
    );
    const {data, total} = result.data;
    if (!_.isEmpty(data)) {
        const totalPage = ceil(total / limit);
        _.each(data, (street) => {
            asyncParser.input.push(JSON.stringify(street));
        })
        if (totalPage > 1) {
            for (let i = 2; i <= totalPage; i++) {
                let resultLoop = await loopStreet(
                    i,
                    limit,
                );
                const {data} = resultLoop.data;
                _.each(data, (street) => {
                    asyncParser.input.push(JSON.stringify(street));
                })
            }
        }
        asyncParser.input.push(null);
    }

}

const loopProvince = (currentPage, limit = {}) => {
    const offset = limit * currentPage - limit;
    return httpGet(
        `${Constants.ADMINISTRATIVE_URL}/province/list`,
        {
            params: {
                limit: limit,
                offset: offset,
                status: [Constants.STATUS_ENUM.ACTIVE, Constants.STATUS_ENUM.PENDING]
            },
        },
    );
};
const loopDistrict = (currentPage, limit = {}) => {
    const offset = limit * currentPage - limit;
    return httpGet(
        `${Constants.ADMINISTRATIVE_URL}/district/list`,
        {
            params: {
                limit: limit,
                offset: offset,
                status: [Constants.STATUS_ENUM.ACTIVE, Constants.STATUS_ENUM.PENDING]
            },
        },
    );
};
const loopWard = (currentPage, limit = {}) => {
    const offset = limit * currentPage - limit;
    return httpGet(
        `${Constants.ADMINISTRATIVE_URL}/ward/list`,
        {
            params: {
                limit: limit,
                offset: offset,
                status: [Constants.STATUS_ENUM.ACTIVE, Constants.STATUS_ENUM.PENDING]
            },
        },
    );
};
const loopStreet = (currentPage, limit = {}) => {
    const offset = limit * currentPage - limit;
    return httpGet(
        `${Constants.ADMINISTRATIVE_URL}/street/list`,
        {
            params: {
                limit: limit,
                offset: offset,
                status: [Constants.STATUS_ENUM.ACTIVE, Constants.STATUS_ENUM.PENDING]
            },
        },
    );
};

(async () => {
    const dirImport = Constants.DIR_DOWNLOAD;
    const directory = 'public' + '/' + dirImport;

    const outputCategoryFilePath = `${directory}/Category.csv`;
    const outputStatusFilePath = `${directory}/Status.csv`;
    const outputProvinceFilePath = `${directory}/Province.csv`;
    const outputDistrictFilePath = `${directory}/District.csv`;
    const outputWardFilePath = `${directory}/Ward.csv`;
    const outputStreetFilePath = `${directory}/Street.csv`;

    await prepareCategory(outputCategoryFilePath);
    await prepareStatus(outputStatusFilePath);
    await prepareProvince(outputProvinceFilePath);
    await prepareDistrict(outputDistrictFilePath);
    await prepareWard(outputWardFilePath);
    await prepareStreet(outputStreetFilePath);

    zip.addLocalFile(outputCategoryFilePath);
    zip.addLocalFile(outputStatusFilePath);
    zip.addLocalFile(outputProvinceFilePath);
    zip.addLocalFile(outputDistrictFilePath);
    zip.addLocalFile(outputWardFilePath);
    zip.addLocalFile(outputStreetFilePath);
    zip.writeZip(`${directory}/masterData.zip`);

    fs.unlinkSync(outputCategoryFilePath);
    fs.unlinkSync(outputStatusFilePath);
    fs.unlinkSync(outputProvinceFilePath);
    fs.unlinkSync(outputDistrictFilePath);
    fs.unlinkSync(outputWardFilePath);
    fs.unlinkSync(outputStreetFilePath);

})();


parentPort.postMessage(message);
