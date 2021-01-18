const SAVE_LOCATION = "courses";
const ACTIONS = [
    "Select an action...",
    "Add Assignment", 
    "Change Assignment(s) Category", 
    "Delete Assignment(s)",
    "Edit Category",
    "Delete Category"
];

const courseDataForm = document.getElementById("courseDataForm");
const coursesSection = document.getElementById("courses");

const addCategoryForm = document.getElementById("addCategoryForm");
const assignmentForm = document.getElementById("addAssignmentForm");

const hasLocalStorage = checkForLocalStorage();
const courses = [];

/**
 * Initialize UI components.
 */
(function initUI() {
    // make sure that the user's browser supports localStorage
    if (hasLocalStorage)
    {
        // get data from localStorage and append to courses array if defined
        const data = localStorage.getItem(SAVE_LOCATION);
        if (data)
        {
            courses.push(...JSON.parse(data));
        }
    }

    interceptAddCategoryForm();

    // render courses
    renderCourses();
})();

/**
 * Render all courses that are stored.
 */
function renderCourses() {
    // clear courses element
    coursesSection.innerHTML = "";

    // render each course
    courses.forEach(renderCourse);
}

/**
 * Render a course's information such as its assignments.
 * @param {Object} course 
 */
function renderCourse(course, index) {
    const section = createElement(coursesSection, "div", { class: "mb-2" });
    
    const header = createElement(section, "h2", { textContent: `${course.name} ` });

    const averageEl = createElement(header, "span", {
        class: `badge rounded-pill`,
        textContent: `0%`
    });

    const calculateAverage = () => {
        // calculate weighted average
        let weightedSum = 0;
        let sumWeights = 0;
        Object.values(course.categories)
            .forEach(category => {
                // only calculate weighted categories that have computed averages
                if (category.weight && category.average) 
                {
                    weightedSum += category.weight * category.average;

                    sumWeights += category.weight;
                }
            }, 0);

        // TODO calculate unweighted average if nothing is weighted?
        const courseAverage = (weightedSum / sumWeights).toFixed(2);

        // calculate average badge color modifier
        let modifier = "";
        if (courseAverage >= 75) 
        {
            modifier = "success";
        }
        else if (courseAverage >= 50) 
        {
            modifier = "warning";
        }
        else 
        {
            modifier = "danger";
        }

        // add category average element
        averageEl.className = `badge rounded-pill bg-${modifier}`;
        averageEl.textContent = `${isNaN(courseAverage) ? 0: courseAverage}%`;
    }

    calculateAverage();

    // render all the categories
    const categories = Object.entries(course.categories);
    categories.forEach(entry => {
        const [ name, category ] = entry;

        // calculate grades for the category
        category.grades
            .forEach(assignment => {
                // if the assignment has a what-if grade
                if (assignment.hasOwnProperty("hypotheticalPoints"))
                {
                    assignment.grade = (assignment.hypotheticalPoints / assignment.possiblePoints) * 100;
                }
                // if the assignment is normally graded
                else
                {
                    assignment.grade = (assignment.actualPoints / assignment.possiblePoints) * 100;
                }
            });

        // create a section for each category to isolate re-renders to smaller sections
        const categorySection = createElement(section, "section");

        // render the category
        renderCategory(index, entry, categorySection, calculateAverage);
    });

    // create button to add a category to the course
    createElement(section, "button", { 
        class: "btn btn-info text-white",
        textContent: "Add Category",
        "data-bs-toggle": "modal",
        "data-bs-target": "#categoryModal",
        onclick: () => {
            // set the value of the course name in the add category form
            document.getElementById("categoryCourseName").value = course.name;
        }
    });

    // create button to remove the course
    createElement(section, "button", {
        class: "btn btn-danger",
        textContent: "Delete Course",
        onclick: () => {
            // ask if the user wants to for sure delete the course
            if (confirm(`Are you sure you want to delete ${course.name}?`))
            {
                // remove the course object
                courses.splice(index, 1);

                // save the course deletion
                saveCourseData();

                // re-render the courses
                renderCourses();
            }
        }
    });
}

/**
 * Render a category of assignments within a course.
 * @param {Object} entry 
 * @param {HTMLElement} section 
 */
function renderCategory(courseIndex, entry, section, changeCallback) {
    // clear out previous section stuff
    section.innerHTML = "";

    // destructure the entry
    const [name, category] = entry;

    // re-calculate average for the category
    if (category.grades.length)
    {
        // TODO account for numDrops
        category.average = category.grades.map(x => x.grade)
            .reduce((a, b) => a + b) / category.grades.length;

        // let the course know that an average has been (re)computed
        changeCallback();
    }

    // create the category header
    const header = createElement(section, "h4", { class: "mb-1" });

    // add category name element
    createElement(header, "span", { textContent: `${name} ` });

    // add category weight element
    createElement(section, "span", {
        class: "fst-italic",
        textContent: category.hasOwnProperty("weight") ?
            `This category accounts for ${category.weight}% of your course grade.`
            :
            `This category needs to be updated with the weight as listed in your syllabus.`
    });

    // calculate average badge color modifier
    let modifier = "";
    if (category.average >= 75) 
    {
        modifier = "success";
    } 
    else if (category.average >= 50) 
    {
        modifier = "warning";
    } 
    else 
    {
        modifier = "danger";
    }

    // add category average element
    const averageEl = createElement(header, "span", {
        class: `badge rounded-pill bg-${modifier}`,
        textContent: `${category.average ? category.average.toFixed(2) : 0}%`
    });

    // sort by name in ascending order by default
    category.grades.sort((a, b) => {
        return a.name.localeCompare(b.name, "en", { numeric: true });
    });

    // create the table starting elements
    const table = createElement(section, "table", { class: "table table-hover mt-2" });
    renderTable(table, category.grades, "nameAsc", () => {
        // calculate the new sum of grades
        const sum = category.grades
            .reduce((sum, curr) => {
                if (curr.hypotheticalPoints)
                {
                    sum += (curr.hypotheticalPoints / curr.possiblePoints) * 100;
                }
                else
                {
                    sum += (curr.actualPoints / curr.possiblePoints) * 100;
                }

                return sum;
            }, 0);

        // calculate the average from the sum and number of assigments
        const average = sum / category.grades.length;
        
        // update the category average element
        averageEl.textContent = `${average.toFixed(2)}%`;
    });

    // create an input group to show the select and button inline
    const inputGroup = createElement(section, "div", { class: "input-group mb-3" });

    // add category switching <select> menu, with the action options
    const categorySwitcher = createElement(inputGroup, "select", { class: "form-control" });
    ACTIONS
        .filter(x => x != categoryName)
        .forEach(x => {
            const option = document.createElement("option");
            option.text = x;
            categorySwitcher.add(option);
        });

    // create the change assignment category button
    const inputGroupAppend = createElement(inputGroup, "div", { class: "input-group-append" });
    createElement(inputGroupAppend, "button", {
        class: "btn btn-primary",
        textContent: "Execute",
        onclick: () => {
            // get the action that the user selected from the options menu
            const choice = categorySwitcher.value;

            // if the user hasn't selected a valid action
            if (choice == "Select an action...")
            {
                alert("Please select an action.");

                return;
            }
            // if the user wants to add an assignment
            else if (choice == "Add Assignment")
            {
                // launch the assignment modal
                const assignmentModal = new bootstrap.Modal(document.getElementById("assignmentModal"));
                assignmentModal.show();

                // reset the form just in case there's some values from an unsubmitted assignment edit 
                assignmentForm.reset();

                // change the title of the modal to reflect that we are adding an assignment (this modal is reused for editing assignments)
                document.getElementById("assignmentModalLabel").textContent = "Add Assignment";

                // bind form submission
                assignmentForm.onsubmit = e => {
                    // prevent actual form submission
                    e.preventDefault();

                    // get form data
                    const formData = new FormData(assignmentForm);

                    // create assignment object from form data
                    const assignment = {
                        name: formData.get("assignmentName"),
                        actualPoints: formData.get("actualPoints"),
                        possiblePoints: formData.get("possiblePoints"),
                    };

                    // pre-calculate the assignment grade
                    assignment.grade = assignment.actualPoints / assignment.possiblePoints * 100;

                    // add the assignment to the category
                    category.grades.push(assignment);

                    // save the updated category grades
                    saveCourseData();

                    // re-render the category
                    changeCallback();
                    renderCategory(courseIndex, entry, section, changeCallback);
                }

                return;
            }
            // if the user wants to change the category name or weight
            else if (choice == "Edit Category")
            {
                // access the boostrap modal and show it
                const categoryModal = new bootstrap.Modal(document.getElementById("categoryModal"));
                categoryModal.show();

                // update the modal title to reflect that we're editing and not adding new
                document.getElementById("categoryModalLabel").textContent = "Edit Category";

                // populate category values
                document.getElementById("categoryCourseName").value = courses[courseIndex].name;
                document.getElementById("categoryName").value = name;
                document.getElementById("categoryWeight").value = category.weight || 0;
                document.getElementById("numDrops").value = category.numDrops || 0;

                addCategoryForm.onsubmit = e => {
                    // prevent actual submission of the form
                    e.preventDefault();

                    // get form data
                    const formData = new FormData(addCategoryForm);

                    // check if we need to rename the category and thus change the key
                    const newName = formData.get("categoryName");
                    if (newName != name)
                    {
                        // https://stackoverflow.com/questions/4647817/javascript-object-rename-key
                        const o = courses[courseIndex].categories;
                        delete Object.assign(o, {[newName]: o[name] })[name];

                        // update category fields
                        o[newName].weight = formData.get("categoryWeight");
                        o[newName].numDrops = formData.get("numDrops");

                        // re-render the courses to show the category name change
                        renderCourses();
                    }
                    // if the category name is unchanged
                    else
                    {
                        // update category fields
                        category.numDrops = parseInt(formData.get("numDrops"), 10);
                        category.weight = parseFloat(formData.get("categoryWeight"));

                        // re-render to show changes
                        changeCallback();
                        renderCategory(courseIndex, entry, section, changeCallback);
                    }

                    // save changes to the category
                    saveCourseData();

                    // reset the form
                    addCategoryForm.reset();

                    // re-bind the add category form submission processing function
                    interceptAddCategoryForm();
                }

                // hide the modal since we're done editing
                // TODO figure out why its not working
                categoryModal.hide();

                return;
            }
            // if the user wants to delete the category
            else if (choice == "Delete Category")
            {
                // make sure the user wants to delete the category
                if (confirm(`Are you sure you want to delete ${name}?`))
                {
                    // TODO move the assignments from the category to an "Unassigned" category

                    // remove the category from the object
                    delete courses[courseIndex].categories[name];

                    // save the changed course
                    saveCourseData();

                    // re-render the courses to remove the category
                    renderCourses();
                }

                return;
            }

            // get the selected assignment indices
            const selectedAssignments = [...section.querySelectorAll("input[type=checkbox]:checked")]
                .map(x => parseInt(x.getAttribute("index"), 10))
                .map(index => category.grades[index])

            // check if the user has selected any assignments
            if (selectedAssignments.length === 0)
            {
                alert("You must select at least one assignment to complete this action.");

                return;
            }

            // if the user wants to re-categorize the assignment(s)
            if (choice == "Change Assignment(s) Category")
            {
                const course = courses[courseIndex];

                const newCategory = prompt("What is the category you wish to move the assignment(s) to?");

                // if the user actually enters a string
                if (newCategory)
                {
                    // check if the category actually exists
                    if (Object.keys(course.categories).includes(newCategory.trim()))
                    {
                        // delete the item from this category and add it to the new category
                        selectedAssignments
                            .forEach(assignment => {
                                // find the assignment in the old category and delete it
                                const index = category.grades.findIndex(x => x == assignment);
                                category.grades.splice(index, 1);

                                // add the item to the new category
                                course.categories[newCategory].grades.push(assignment);
                            });

                        // save changed data
                        saveCourseData();

                        // re-render to show changes
                        // TODO figure out if i can do a more localized re-render? rendering all of courses for a category change is OD
                        renderCourses();
                    }
                }
            }
            // if the user wants to delete the assignment(s)
            else if (choice == "Delete Assignment(s)")
            {
                // make sure the user wants to delete their assignments
                if (confirm("Are you sure you want to delete these assignments?")) 
                {
                    // delete the item from this category
                    selectedAssignments
                        .forEach(assignment => {
                            // find the assignment(s) and delete it
                            const index = category.grades.findIndex(x => x == assignment);
                            category.grades.splice(index, 1);
                        });

                    // save changed data
                    saveCourseData();

                    // re-render to show changes
                    changeCallback();
                    renderCategory(courseIndex, entry, section, changeCallback);
                }
            }
        }
    });
}

/**
 * Render a table of grades.
 * @param {HTMLElement} table 
 * @param {Object} grades 
 * @param {Boolean} isRerender 
 * @param {Boolean} reverse 
 */
function renderTable(table, grades, sort="nameAsc", gradeChangeCallback) {
    // create thead and tbody to be semantic but also to follow Boostrap guidelines
    const thead = createElement(table, "thead");
    const tbody = createElement(table, "tbody");

    // create table header row
    const tableHeaderRow = createElement(thead, "tr");

    createElement(tableHeaderRow, "th");

    // create name column header
    createElement(tableHeaderRow, "th", {
        textContent: "Name",
        // sort on header click
        onclick: () => {
            // if the previous sort was not by name or was previously name descending, sort with name ascending
            if (!sort.includes("name") || sort == "nameDesc")
            {
                sort = "nameAsc";
            }
            // if previous sort was name ascending, sort with name descending
            else
            {
                sort = "nameDesc";
            }

            // sort the way as decided above
            grades.sort((a, b) => {
                if (sort == "nameDesc") 
                {
                    return b.name.localeCompare(a.name, "en", { numeric: true });
                }
                else 
                {
                    return a.name.localeCompare(b.name, "en", { numeric: true });
                }
            });
            
            // re-render table
            table.innerHTML = "";
            renderTable(table, grades, sort, gradeChangeCallback);
        }
    });
    
    // create score column header
    createElement(tableHeaderRow, "th", { 
        textContent: "Score",
        onclick: () => {
            // if the previous sort was not by score or was previously score descending, sort with score ascending
            if (!sort.includes("score") || sort == "scoreDesc")
            {
                sort = "scoreAsc";
            }
            // if previous sort was score ascending, sort with score descending
            else
            {
                sort = "scoreDesc";
            }

            // sort by score
            grades.sort((a, b) => {
                if (sort == "scoreDesc") 
                {
                    return b.actualPoints - a.actualPoints;
                }
                else 
                {
                    return a.actualPoints - b.actualPoints;
                }
            });

            // re-render table
            table.innerHTML = "";
            renderTable(table, grades, sort, gradeChangeCallback);
        }
    });
    
    // create out of column header
    createElement(tableHeaderRow, "th", { 
        textContent: "Out of",
        onclick: () => {
            // if the previous sort was not by outOf or was previously score descending, sort with outOf ascending
            if (!sort.includes("outOf") || sort == "outOfDesc")
            {
                sort = "outOfAsc";
            }
            // if previous sort was score ascending, sort with score descending
            else
            {
                sort = "outOfDesc";
            }

            // sort by outOf
            grades.sort((a, b) => {
                if (sort == "outOfDesc") 
                {
                    return b.possiblePoints - a.possiblePoints;
                }
                else 
                {
                    return a.possiblePoints - b.possiblePoints;
                }
            });

            // re-render table
            table.innerHTML = "";
            renderTable(table, grades, sort, gradeChangeCallback);
        }
    });
    
    // create grade column header
    createElement(tableHeaderRow, "th", {
        textContent: "Grade",
        onclick: () => {
            // if the previous sort was not by grade or was previously grade descending, sort with grade ascending
            if (!sort.includes("grade") || sort == "gradeDesc")
            {
                sort = "gradeAsc";
            }
            // if previous sort was grade ascending, sort with grade descending
            else
            {
                sort = "gradeDesc";
            }

            // sort by grade
            grades.sort((a, b) => {
                if (sort == "gradeDesc") 
                {
                    return a.grade - b.grade;
                }
                else 
                {
                    return b.grade - a.grade;
                }
            });
            
            // re-render table
            table.innerHTML = "";
            renderTable(table, grades, sort, gradeChangeCallback);
        }
    });
    
    // create actions column header
    createElement(tableHeaderRow, "th", { textContent: "Actions" });

    // create rows for all category assignments
    grades.forEach((assignment, index) => {
        const row = createElement(tbody, "tr");

        // create checkbox for group actions
        const checkboxParent = createElement(row, "td");
        createElement(checkboxParent, "input", { 
            type: "checkbox",
            index: index
        });

        createElement(row, "td", { textContent: assignment.name });
        createElement(row, "td", { 
            textContent: assignment.actualPoints,
            // allow the user to test hypothetical grade on their assignment on click
            onclick: e => {
                // get reference to the table cell that was clicked
                const cell = e.target;
                
                // get points before clearing
                const points = cell.innerHTML;
                
                // clear cell
                cell.innerHTML = "";
                
                // add input element to get what-if points
                const input = createElement(cell, "input", {
                    class: "form-control",
                    style: "width: 6em",
                    type: "number",
                    value: points,
                    onkeydown: e => {                      
                        // if the user wants to save their hypothetical value
                        if (e.key == "Enter") 
                        {
                            // update the assignment object
                            assignment.hypotheticalPoints = parseFloat(e.target.value).toFixed(2);

                            // get rid of the input and show the hypothetical point value
                            cell.innerHTML = assignment.hypotheticalPoints;

                            // calculate the grade with the hypothetical points
                            const gradeCell = cell.parentNode.cells[3];
                            gradeCell.innerText = `${(assignment.hypotheticalPoints / assignment.possiblePoints * 100).toFixed(2)}%`;

                            // change row color to know that it houses a hypothetical value
                            row.classList.add("table-info");
                            
                            // let the category know that a grade value has changed
                            gradeChangeCallback();
                        }
                        // if the user wants to exit editing mode
                        else if (e.key == "Escape") 
                        {
                            cell.innerHTML = points;
                        }
                    }
                });
                
                // autofocus on what-if input
                input.focus();
            }
        });

        createElement(row, "td", { textContent: assignment.possiblePoints });

        createElement(row, "td", {
            textContent: `${assignment.grade.toFixed(2)}%`
        });

        const actionCell = createElement(row, "td", {
            class: "text-underline"
        });

        // create an edit assignment "link" that should act like a button to launch the modal
        createElement(actionCell, "span", {
            class: "fake-link text-decoration-underline",
            textContent: "Edit",
            onclick: () => {
                // launch the assignment modal
                const assignmentModal = new bootstrap.Modal(document.getElementById("assignmentModal"));
                assignmentModal.show();

                // update the modal title to reflect that we're editing an assignment
                document.getElementById("assignmentModalLabel").textContent = "Edit Assignment";

                // populate the form fields
                document.getElementById("assignmentName").value = assignment.name;
                document.getElementById("actualPoints").value = assignment.actualPoints;
                document.getElementById("possiblePoints").value = assignment.possiblePoints;

                // intercept the form from being submitted
                assignmentForm.onsubmit = e => {
                    // prevent the form from actually being submitted
                    e.preventDefault();

                    // get data from the form
                    const formData = new FormData(assignmentForm);

                    // get the data and update the form
                    assignment.name = formData.get("assignmentName");
                    assignment.actualPoints = parseFloat(formData.get("actualPoints"));
                    assignment.possiblePoints = parseFloat(formData.get("possiblePoints"));
                    
                    // reset the form
                    assignmentForm.reset();

                    // save the changes made to teh assignment object
                    saveCourseData();

                    // let the category know that a grade value has changed
                    gradeChangeCallback();

                    // re-render table
                    table.innerHTML = "";
                    renderTable(table, grades, sort, gradeChangeCallback);
                }
            }
        });
    });
}

/**
 * Process the course data form submission to add the data to the working memory and localStorage.
 * @param {Event} e 
 */
courseDataForm.onsubmit = async e => {
    // prevent the form from actually being submitted
    e.preventDefault();

    // get the form data into an easily query-able structure
    const formData = new FormData(courseDataForm);

    // get assorted fields from the form submission
    const courseName = formData.get("courseName");
    const numCredits = formData.get("numCredits");
    const courseGradesDataFile = formData.get("courseData");

    // get the file text to parse as JSON
    const courseGradesDataFileContents = await courseGradesDataFile.text();
    const courseGradesDataObject = tryParseJSON(courseGradesDataFileContents);

    // make sure at the very least the user uploaded a valid JSON file
    if (courseGradesDataObject)
    {
        // create a course data object that will be stored in a course array
        const courseDataObject = {
            name: courseName,
            credits: numCredits,
            categories: courseGradesDataObject
        };

        // for each category, calculate the percentage grades
        Object.values(courseDataObject.categories)
            .forEach(category => {
                // add all grade entries for the category
                category.grades
                    .forEach(entry => {
                        // show the actual points out of the possible points, and the percentage value
                        entry.grade = `${entry.actualPoints} / ${parseFloat(entry.possiblePoints, 10).toFixed(2)}`;
                    });
            });

        // add course data object to course array
        courses.push(courseDataObject);

        // close modal
        const addCoursesModal = bootstrap.Modal.getInstance(document.getElementById("addCourseGradesModal"));
        addCoursesModal.hide();

        // save course array to localStorage
        saveCourseData();

        // show newly added course
        renderCourses();
    }
}

/**
 * Process the add category form submission to add a category to a course.
 * @param {Event} e 
 */
function interceptAddCategoryForm() {
    addCategoryForm.onsubmit = e => {
        // prevent the form from actually being submitted
        e.preventDefault();

        // enable the form input so we can get data from it
        document.getElementById("categoryCourseName").disabled = false;

        // get the form data into an easily query-able structure
        const formData = new FormData(addCategoryForm);

        // get the data from the form
        const courseName = formData.get("categoryCourseName");
        const categoryName = formData.get("categoryName");
        const categoryWeight = formData.get("categoryWeight");
        const numDrops = formData.get("numDrops"); // guaranteed to be a number b/c of input type, min, and default

        // find the course that is being added to
        const course = courses.find(x => x.name == courseName);

        // define the category in the categories object
        course.categories[categoryName] = {};

        // initalize the category's data fields
        course.categories[categoryName].grades = [];
        course.categories[categoryName].weight = parseFloat(categoryWeight);
        course.categories[categoryName].numDrops = parseInt(numDrops, 10);

        // close modal
        const addCategoryModal = bootstrap.Modal.getInstance(document.getElementById("categoryModal"));
        addCategoryModal.hide();

        // reset the modal
        document.getElementById("categoryCourseName").disabled = true;
        addCategoryForm.reset();

        // save changes to the course grades array
        saveCourseData();

        // render the changes
        renderCourses();
    }
}

/**
 * https://stackoverflow.com/questions/3710204/how-to-check-if-a-string-is-a-valid-json-string-in-javascript-without-using-try
 * @param {String} jsonString 
 * @returns {Boolean} isValid
 */
function tryParseJSON(jsonString) {
    try {
        const o = JSON.parse(jsonString);

        // Handle non-exception-throwing cases:
        // Neither JSON.parse(false) or JSON.parse(1234) throw errors, hence the type-checking,
        // but... JSON.parse(null) returns null, and typeof null === "object", 
        // so we must check for that, too. Thankfully, null is falsy, so this suffices:
        if (o && typeof o == "object") 
        {
            return o;
        }
    }
    catch (e) {}

    return false;
}

/**
 * Save the course data to localStorage.
 */
function saveCourseData() {
    // check if user's browser supports localStorage before trying to save
    if (hasLocalStorage)
    {
        localStorage.setItem(SAVE_LOCATION, JSON.stringify(courses));
    }
}

/**
 * Create an HTML element and add it to the DOM tree.
 * @param {HTMLElement} parent 
 * @param {String} tag 
 * @param {Object} attributes 
 */
function createElement(parent, tag, attributes={}) {
    // create the element to whatever tag was given
    const el = document.createElement(tag);
    
    // go through all the attributes in the object that was given
    Object.entries(attributes)
        .forEach(([attr, value]) => {
            // handle the various special cases that will cause the Element to be malformed
            if (attr == "innerText") 
            {
                el.innerText = value;
            }
            else if (attr == "innerHTML") 
            {
                el.innerHTML = value;
            }
            else if (attr == "textContent") 
            {
                el.textContent = value;
            }
            else if (attr == "onclick")
            {
                el.onclick = value;
            }
            else if (attr == "onkeydown")
            {
                el.onkeydown = value;
            }
            else
            {
                el.setAttribute(attr, value);
            }
        });
    
    // add the newly created element to its parent
    parent.appendChild(el);

    // return the element in case this element is a parent for later element creation
    return el;
}

/**
 * Check if localStorage exist and is available.
 * https://stackoverflow.com/questions/16427636/check-if-localstorage-is-available/16427747
 * @return {Boolean} localStorageExists
 */
function checkForLocalStorage(){
    const test = "test";

    try {
        localStorage.setItem(test, test);
        localStorage.removeItem(test);

        return true;
    } catch(e) {
        return false;
    }
}