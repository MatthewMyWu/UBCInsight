
const courses_fields = [
	{Title: "title"},
	{Department: "dept"},
	{ID: "id"},
	{Average: "avg"},
	{Year: "year"},
	{Instructor: "instructor"},
]

const rooms_fields = [
	{Fullname: "fullname"},
	{Shortname: "shortname"},
	{Number: "number"},
	{Address: "address"},
	{Seats: "seats"},
	{Website: "href"},
]


var app = new Vue({
	el: '#app',
	data: {
		specify_name: '',
		specify_name_placeholder: 'CPSC',
		specify_number: '',
		specify_number_placeholder: '310',
		order_dir: '',
		order_field: '',
		dataset_id: 'courses',
		dataset_specifier: 'course(s)',
		table_header: 'Results',
		fields: courses_fields,
		postQuery: postCoursesQuery,
		results: [],
		error: false,
		error_message: '',
	},
	methods: {
		change_courses() {
			this.fields = courses_fields;
			this.postQuery = postCoursesQuery;
			this.dataset_id = 'courses';
			this.dataset_specifier = 'course(s)';
			this.specify_name_placeholder = 'CPSC';
			this.specify_number_placeholder = '310';
			this.order_field = "";
			this.resetResults();
		},
		change_rooms() {
			this.fields = rooms_fields;
			this.postQuery = postRoomsQuery;
			this.dataset_id = 'rooms';
			this.dataset_specifier = 'room(s)';
			this.specify_name_placeholder = 'HEBB';
			this.specify_number_placeholder = '100';
			this.order_field = "";
			this.resetResults();
		},
		submit: async function (event) {
			const specifyName = this.specify_name === '' || this.specify_name === undefined ? "*" : this.specify_name;
			const specifyNumber = this.specify_number === '' || this.specify_number === undefined ? "*" : this.specify_number;

			this.validateFields();

			if (this.error) {
				return;
			}
			this.table_header = `${specifyName} ${specifyNumber}`
			const output = await this.postQuery(this.dataset_id, specifyName, specifyNumber, this.fields, this.order_dir, this.order_field);

			if (output) {
				this.results = output;
			} else {
				this.resetResults();
				this.error = true;
				this.error_message = "Invalid query (perhaps query yielded too many results)";
			}
		},
		resetResults: function() {
			this.table_header = "Results";
			this.results = [];
		},
		validateFields: function() {
			if (this.specify_name.includes('_')) {
				this.error_message = this.dataset_specifier + " name can not include underscore.";
			} else if (this.specify_name.length >= 3 && this.specify_name.substring(1, this.specify_name.length - 1).includes("*")) {
				this.error_message = this.dataset_specifier + " name can only have asterisk as first or last character.";
			} else if (this.specify_number.length >= 3 && this.specify_number.substring(1, this.specify_number.length - 1).includes("*")) {
				this.error_message = this.dataset_specifier + " number can only have asterisk as first or last character.";
			} else if (this.order_dir === '') {
				this.error_message = "Please select an order direction."
			} else if (this.order_field === '') {
				this.error_message = "Please select a field to order results by."
			}
			else {
				this.error = false;
				return;
			}

			this.error = true;
			this.resetResults();
		}
	}
})

function echo(message) {
	axios.get(`http://localhost:4321/echo/msg=${message}`)
		.then(function (response) {
			console.log(response);
		})
}

// Query formatter functions
//////////////////////////////////////////////////////////////////////////////////////////////////////////
//////////////////////////////////////////////////////////////////////////////////////////////////////////


// Function that will post a courses query
function postCoursesQuery(datasetID, specifyName, specifyNumber, fields, orderDir, orderField) {
	specifyName = specifyName.toLowerCase();
	const where = {
		"AND": [
			{
				"IS": {
					[`${datasetID}_dept`]: specifyName
				}
			},
			{
				"IS": {
					[`${datasetID}_id`]: specifyNumber
				}
			}
		]
	};

	return postGenericQuery(datasetID, fields, orderDir, orderField, where);
}

// Function that will post a rooms query
function postRoomsQuery(datasetID, specifyName, specifyNumber, fields, orderDir, orderField) {
	specifyName = specifyName.toUpperCase();
	const where = {
		"AND": [
			{
				"IS": {
					[`${datasetID}_shortname`]: specifyName
				}
			},
			{
				"IS": {
					[`${datasetID}_number`]: specifyNumber
				}
			}
		]
	};

	return postGenericQuery(datasetID, fields, orderDir, orderField, where);
}

// Generic helper function for postCoursesQuery and postRoomsQuery
function postGenericQuery(datasetID, fields, orderDir, orderField, where) {
	orderField = `${datasetID}_${orderField}`;
	const columns = [];
	for (const observer of fields) {
		columns.push(`${datasetID}_${Object.values(observer)[0]}`);
	}
	const query = {
		"WHERE": where,
		"OPTIONS": {
			"COLUMNS": columns,
			"ORDER": {
				"dir": orderDir,
				"keys": [
					orderField
				]
			}
		}
	};

	return axios.post('http://localhost:4321/query', query)
		.then(function (response) {
			return response.data.result;
		})
		.catch(function (error) {
			console.log(error);
		});
}
